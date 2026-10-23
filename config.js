// ==========================================
// KONFIGURASI SUPABASE (PUSAT)
// ==========================================
const SUPABASE_URL = 'https://rdzrzzjykhbqvaaxdrvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkenJ6emp5a2hicXZhYXhkcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTU3MTEsImV4cCI6MjEwMTUzMTcxMX0.sF3NqFM6ldqEAsd0Mq_wKUvfkoACAlohM5VW92zhcKg';

// Inisialisasi client Supabase secara global
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
