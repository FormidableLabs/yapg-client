select
  id,
  "createdAt",
  "eventStatus",
  "externalId",
  "processorId",
  "updatedAt",
  "revision",
  extract(second from "updatedAt" - "createdAt") as "runTime"
from demo_events
order by id desc;
