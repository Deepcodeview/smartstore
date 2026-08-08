import queue

class FrameStreamer:
    def __init__(self):
        self.queues = {}

    def register(self, job_id):
        q = queue.Queue(maxsize=15)
        if job_id not in self.queues:
            self.queues[job_id] = []
        self.queues[job_id].append(q)
        return q

    def unregister(self, job_id, q):
        if job_id in self.queues:
            if q in self.queues[job_id]:
                self.queues[job_id].remove(q)
            if not self.queues[job_id]:
                del self.queues[job_id]

    def put(self, job_id, jpeg_bytes):
        if job_id in self.queues:
            for q in self.queues[job_id]:
                try:
                    if q.full():
                        q.get_nowait()  # Drop oldest frame to maintain real-time
                    q.put_nowait(jpeg_bytes)
                except Exception:
                    pass

frame_streamer = FrameStreamer()
