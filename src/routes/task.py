from fastapi import APIRouter
from models import ApiExecuteResponse, TranConfig
from core.queue import FilesQueue

task_router = APIRouter(prefix="/task", tags=["Task"])


@task_router.post("/run", response_model=None)
async def run_tasks(args: TranConfig):
    FilesQueue.spawn_worker_instance(args)


@task_router.post("/retry", response_model=None)
async def retry_tasks():
    FilesQueue.retry_failed()


@task_router.get("/progress", response_model=list[ApiExecuteResponse])
async def get_tasks_progress():
    return [worker.progress for worker in FilesQueue.workers]


@task_router.get("/done", response_model=bool)
async def get_tasks_done():
    if len(FilesQueue.workers) == 0:
        return False
    if FilesQueue.completion_task is not None and not FilesQueue.completion_task.done():
        return False

    return all(worker.worker.done() for worker in FilesQueue.workers)
