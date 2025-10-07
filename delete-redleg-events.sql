-- Delete events from Red Leg Brewing Company only
-- This script is safe and targeted

-- First, let's see what we're about to delete
SELECT 
    COUNT(*) as total_events_to_delete,
    'Red Leg Brewing Company' as brewery_name
FROM events_base e
JOIN breweries b ON e.brewery_id = b.id
WHERE b.name = 'Red Leg Brewing Company';

-- Show some examples of what will be deleted
SELECT 
    e.title,
    e.event_date,
    e.event_time,
    e.created_at
FROM events_base e
JOIN breweries b ON e.brewery_id = b.id
WHERE b.name = 'Red Leg Brewing Company'
ORDER BY e.created_at DESC
LIMIT 10;

-- Actually delete the events (uncomment the line below when ready)
-- DELETE FROM events_base 
-- WHERE brewery_id IN (
--     SELECT id FROM breweries WHERE name = 'Red Leg Brewing Company'
-- );

-- Verify deletion (run this after the delete)
-- SELECT COUNT(*) as remaining_redleg_events
-- FROM events_base e
-- JOIN breweries b ON e.brewery_id = b.id
-- WHERE b.name = 'Red Leg Brewing Company';
