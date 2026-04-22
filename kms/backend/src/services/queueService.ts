/**
 * BullMQ document processing queue.
 *
 * Flow:
 *   1. Upload endpoint adds a job to the queue
 *   2. Worker picks up the job, calls Python microservice
 *   3. Python processes async, calls /api/internal/callback when done
 *   4. Callback updates document status in PostgreSQL
 *
 * Retry strategy: 3 attempts with exponential backoff
 */
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { bullmqRedis as redis } from '../config/redis';
import { pythonClient, ProcessDocumentPayload } from './pythonClient';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const QUEUE_NAME = 'document-processing';

// ─── Queue definition ──────────────────────────────────────────────

export const documentQueue = new Queue<ProcessDocumentPayload>(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 10s → 20s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ─── Worker ────────────────────────────────────────────────────────

let worker: Worker | null = null;

export function startDocumentWorker(): void {
  if (worker) return; // Prevent duplicate workers

  worker = new Worker<ProcessDocumentPayload>(
    QUEUE_NAME,
    async (job: Job<ProcessDocumentPayload>) => {
      const { document_id, file_path, file_type, title, metadata } = job.data;
      logger.info(`[Queue] Processing job ${job.id} — document: ${document_id}`);

      // Mark as processing in DB
      await prisma.document.update({
        where: { id: document_id },
        data: { status: 'processing' },
      });

      try {
        // Dispatch to Python service (async — Python will callback)
        await pythonClient.processDocument({
          document_id,
          file_path,
          file_type,
          title,
          metadata,
        });

        logger.info(`[Queue] Job ${job.id} dispatched to Python service`);
      } catch (error) {
        // Python call failed — mark document as failed immediately
        await prisma.document.update({
          where: { id: document_id },
          data: {
            status: 'failed',
            errorMessage: (error as Error).message,
          },
        });
        throw error; // Re-throw so BullMQ retries
      }
    },
    {
      connection: redis,
      concurrency: 3, // Process up to 3 documents simultaneously
    }
  );

  worker.on('completed', (job) => {
    logger.info(`[Queue] Job ${job.id} dispatched successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Queue] Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error('[Queue] Worker error:', err);
  });

  logger.info('✅ Document processing worker started');
}

export function stopDocumentWorker(): Promise<void> {
  return worker?.close() ?? Promise.resolve();
}

// ─── Queue Events (for monitoring) ────────────────────────────────

export const queueEvents = new QueueEvents(QUEUE_NAME, { connection: redis });

/**
 * Add a document processing job to the queue.
 */
export async function enqueueDocument(payload: ProcessDocumentPayload): Promise<string> {
  const job = await documentQueue.add('process', payload, {
    jobId: `doc-${payload.document_id}`,
  });
  logger.info(`[Queue] Enqueued document: ${payload.document_id} (job: ${job.id})`);
  return job.id ?? payload.document_id;
}
