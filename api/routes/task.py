from fastapi import APIRouter
from models import ApiExecuteResponse, TranConfig
from src.queue import FilesQueue

task_router = APIRouter(prefix="/task", tags=["Task"])


@task_router.post("/run", response_model=None)
async def run_tasks(args: TranConfig):
    FilesQueue.spawn_worker_instance(args)


@task_router.get("/progress", response_model=list[ApiExecuteResponse])
async def get_tasks_progress():
    return [worker.progress for worker in FilesQueue.workers]


@task_router.get("/done", response_model=bool)
async def get_tasks_done():
    if len(FilesQueue.workers) == 0:
        return False

    return all(worker.done for worker in FilesQueue.workers)
