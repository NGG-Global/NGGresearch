import '@testing-library/dom';

// Demo mode keeps every test independent of Supabase and Google credentials.
process.env.APP_MODE = 'demo';
delete process.env.ANTHROPIC_API_KEY;
