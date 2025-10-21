require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase environment variables');
      process.exit(1);
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('✅ Supabase client created');

    // Test connection
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection failed:', error);
      process.exit(1);
    }

    console.log('✅ Supabase connection successful');
    console.log('📊 Available tables:', data);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSupabase();
