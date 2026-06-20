/**
 * ob-queue
 * BullMQ wrapper. Abstracts queue creation, job enqueue, and worker setup.
 * Workers drain gracefully on SIGTERM.
 *
 * Usage:
 *   import queue from 'ob-queue'
 *
 *   // Enqueue a job (from ob-server or ob-bus handler)
 *   await queue.add('notifications', 'send-email', { to, subject, body })
 *
 *   // Process jobs (in ob-worker service)
 *   queue.process('notifications', 'send-email', async (job) => {
 *     await sendEmail(job.data)
 *   })
 *
 *   // Graceful shutdown
 *   await queue.close()
 */

import { Queue, Worker, QueueEvents } from 'bullmq';

class OgQueue {
    #connection; // ioredis connection options or instance
    #queues = new Map();
    #workers = new Map();
    #logger = console;

    constructor({ connection = { host: 'localhost', port: 6379 }, logger = console } = {}) {
        this.#connection = connection;
        this.#logger = logger;
    }

    // ─── Enqueue ────────────────────────────────────────────────────────────────

    /**
   * Add a job to a named queue.
   *
   * @param {string} queueName  - logical queue name (e.g. 'notifications')
   * @param {string} jobName    - job type (e.g. 'send-email')
   * @param {object} data       - job payload
   * @param {object} opts       - BullMQ JobsOptions (delay, priority, attempts …)
   */
    async add(queueName, jobName, data = {}, opts = {}) {
        const q = this.#getOrCreateQueue(queueName);
        const job = await q.add(jobName, data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
            ...opts,
        });
        this.#logger.info(`[ob-queue] Enqueued ${queueName}/${jobName} → job#${job.id}`);
        return job;
    }

    // ─── Process ────────────────────────────────────────────────────────────────

    /**
   * Register a processor for a specific job type on a queue.
   * Spins up a BullMQ Worker if one doesn't exist for this queue yet.
   *
   * @param {string}   queueName  - queue to consume from
   * @param {string}   jobName    - job type to handle ('' = handle all)
   * @param {Function} handler    - async (job) => result
   * @param {object}   opts       - BullMQ WorkerOptions (concurrency …)
   */
    process(queueName, jobName, handler, opts = {}) {
    // BullMQ workers handle all jobs on a queue; we route by job.name here
        if (!this.#workers.has(queueName)) {
            const worker = this.#createWorker(queueName, opts);
            this.#workers.set(queueName, { worker, processors: new Map() });
        }

        const { processors } = this.#workers.get(queueName);
        processors.set(jobName, handler);
        this.#logger.info(`[ob-queue] Registered processor: ${queueName}/${jobName || '*'}`);
        return this;
    }

    #createWorker(queueName, opts = {}) {
        const worker = new Worker(
            queueName,
            async(job) => {
                const { processors } = this.#workers.get(queueName);
                const handler = processors.get(job.name) ?? processors.get('');
                if (!handler) {
                    throw new Error(`[ob-queue] No processor for ${queueName}/${job.name}`);
                }
                this.#logger.info(`[ob-queue] Processing ${queueName}/${job.name} job#${job.id}`);
                return handler(job);
            },
            {
                connection: this.#connection,
                concurrency: 5,
                ...opts,
            }
        );

        worker.on('completed', (job) =>
            this.#logger.info(`[ob-queue] ✓ ${queueName}/${job.name} job#${job.id}`)
        );
        worker.on('failed', (job, err) =>
            this.#logger.error(`[ob-queue] ✗ ${queueName}/${job?.name} job#${job?.id}:`, err.message)
        );

        return worker;
    }

    // ─── Queue Events (metrics / monitoring) ────────────────────────────────────

    /**
   * Subscribe to queue-level events (completed, failed, progress …)
   * Useful for emitting metrics to ob-telemetry.
   */
    onQueueEvent(queueName, event, handler) {
        const qe = new QueueEvents(queueName, { connection: this.#connection });
        qe.on(event, handler);
        return this;
    }

    // ─── Introspection ──────────────────────────────────────────────────────────

    async getStats(queueName) {
        const q = this.#getOrCreateQueue(queueName);
        const [waiting, active, completed, failed] = await Promise.all([
            q.getWaitingCount(),
            q.getActiveCount(),
            q.getCompletedCount(),
            q.getFailedCount(),
        ]);
        return { queueName, waiting, active, completed, failed };
    }

    // ─── Shutdown ───────────────────────────────────────────────────────────────

    /**
   * Gracefully close all workers and queues.
   * Workers finish their current job before closing.
   */
    async close() {
        this.#logger.info('[ob-queue] Closing workers …');
        await Promise.all(
            [...this.#workers.values()].map(({ worker }) => worker.close())
        );
        await Promise.all(
            [...this.#queues.values()].map((q) => q.close())
        );
        this.#logger.info('[ob-queue] All workers closed');
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    #getOrCreateQueue(name) {
        if (!this.#queues.has(name)) {
            this.#queues.set(name, new Queue(name, { connection: this.#connection }));
        }
        return this.#queues.get(name);
    }
}

// Singleton — initialized lazily with connection from ob-config
let _instance = null;

function getQueue(options = {}) {
    if (!_instance) {_instance = new OgQueue(options);}
    return _instance;
}

export default getQueue;
export { OgQueue, getQueue };
