require("dotenv").config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

async function showDatabaseState() {
  try {
    console.log('🔍 Checking database state...');
    
    // First, let's see how many events we have
    const { data: allEvents, error: countError } = await supabase
      .from('events_base')
      .select('id, title, created_at, brewery_id')
      .order('created_at', { ascending: false });
    
    if (countError) {
      throw countError;
    }
    
    console.log(`📊 Found ${allEvents.length} total events in database`);
    
    // Show recent events (last 20)
    console.log('\n📅 Recent events:');
    allEvents.slice(0, 20).forEach((event, i) => {
      const date = new Date(event.created_at).toLocaleString();
      console.log(`${i + 1}. "${event.title}" (${date})`);
    });
    
    // Group by brewery
    const breweryCounts = {};
    allEvents.forEach(event => {
      breweryCounts[event.brewery_id] = (breweryCounts[event.brewery_id] || 0) + 1;
    });
    
    console.log('\n🏭 Events by brewery:');
    for (const [breweryId, count] of Object.entries(breweryCounts)) {
      console.log(`  ${breweryId}: ${count} events`);
    }
    
    console.log('\n⚠️  This is just a READ-ONLY check. No data was deleted.');
    console.log('💡 If you want to clean up, we can create a more targeted approach.');
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

showDatabaseState();
