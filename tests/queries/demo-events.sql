DROP TABLE IF EXISTS public.demo_events CASCADE;

CREATE TABLE IF NOT EXISTS public.demo_events (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "eventStatus" text NOT NULL DEFAULT 'new',
  "eventType" text NOT NULL DEFAULT 'inventory-recalculation',
  "externalId" text NOT NULL,
  "processorId" text,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.demo_events_trigger()
  RETURNS trigger
  LANGUAGE 'plpgsql'

  AS $BODY$

    BEGIN

      CASE TG_OP
        WHEN 'INSERT' THEN
          PERFORM pg_notify('demo_events', NEW."id"::text);

      END CASE;

      RETURN NULL;

    END;

$BODY$;

CREATE TRIGGER demo_events_trigger
  AFTER INSERT
  ON public.demo_events
  FOR EACH ROW
  EXECUTE FUNCTION public.demo_events_trigger ();
