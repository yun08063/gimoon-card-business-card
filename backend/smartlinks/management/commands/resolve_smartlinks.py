import logging
import time
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import close_old_connections, transaction
from django.utils import timezone
from smartlinks.catalog import ProviderError
from smartlinks.models import Resolution
from smartlinks.services import resolve

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Process persisted album resolution jobs. Run separately from the API server."
    cleanup_interval = 60 * 60

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        last_cleanup = 0
        while True:
            close_old_connections()
            now = timezone.now()
            if time.monotonic() - last_cleanup >= self.cleanup_interval:
                cutoff = now - timedelta(days=7)
                Resolution.objects.filter(
                    status="failed", updated_at__lt=cutoff
                ).delete()
                last_cleanup = time.monotonic()

            # Recover a job after a crashed worker without leaving the UI polling forever.
            Resolution.objects.filter(
                status="processing", updated_at__lt=now - timedelta(minutes=10)
            ).update(
                status="failed",
                error="처리 시간이 초과되었습니다. 다시 검색해 주세요.",
                updated_at=now,
            )
            with transaction.atomic():
                job = Resolution.objects.select_for_update(skip_locked=True).filter(status="queued").order_by("created_at").first()
                if job:
                    job.status = "processing"
                    job.save(update_fields=["status", "updated_at"])
            if job:
                try:
                    job.result = resolve(job.source_url, job.country)
                    job.status = "ready"
                except ProviderError as error:
                    job.status, job.error = "failed", str(error)
                except Exception:
                    logger.exception("Resolution failed: %s", job.id)
                    job.status, job.error = "failed", "앨범 정보 처리에 실패했습니다. 주소를 확인하고 다시 시도해 주세요."
                job.save(update_fields=["status", "result", "error", "updated_at"])
            elif options["once"]:
                return
            else:
                time.sleep(2)
