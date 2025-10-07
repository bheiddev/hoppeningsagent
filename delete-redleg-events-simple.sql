-- Delete all events from Red Leg Brewing Company
-- Using the brewery UUID we know from the logs: bea64f0b-dc93-4fed-8c87-53190e746a6a

DELETE FROM events_base 
WHERE brewery_id = 'bea64f0b-dc93-4fed-8c87-53190e746a6a';
