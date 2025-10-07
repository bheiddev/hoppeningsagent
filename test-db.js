// Test script to verify Supabase connection
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabaseConnection() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables!');
    console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
    return;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    // Test connection by querying breweries table
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase
      .from('breweries')
      .select('id, name')
      .limit(5);

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return;
    }

    console.log('✅ Supabase connection successful!');
    console.log(`📊 Found ${data.length} breweries in database:`);
    data.forEach(brewery => {
      console.log(`  - ${brewery.name} (${brewery.id})`);
    });

    // Test events table
    const { data: events, error: eventsError } = await supabase
      .from('events_base')
      .select('id, title, event_date')
      .limit(3);

    if (eventsError) {
      console.error('❌ Events table query failed:', eventsError.message);
      return;
    }

    console.log(`📅 Found ${events.length} events in database:`);
    events.forEach(event => {
      console.log(`  - ${event.title} on ${event.event_date} (${event.id})`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSupabaseConnection();

