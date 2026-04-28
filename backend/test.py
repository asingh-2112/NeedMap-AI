import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

print("=" * 80)
print("🔍 TESTING DATABASE CONNECTION")
print("=" * 80)

try:
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print('\n❌ ERROR: DATABASE_URL not found in .env')
        exit(1)
    
    print(f'\n✓ DATABASE_URL loaded: {db_url.split("@")[0]}@***')
    
    print('\n⏳ Creating engine...')
    engine = create_engine(db_url)
    print('✓ Engine created')
    
    print('\n⏳ Testing connection to Supabase...')
    with engine.connect() as conn:
        result = conn.execute(text('SELECT 1'))
        print('✅ CONNECTION SUCCESSFUL!')
        print(f'   Server response: {result.fetchone()}')
    
    print('\n' + '=' * 80)
    print('✅ DATABASE CONNECTION TEST PASSED!')
    print('=' * 80)
    
except Exception as e:
    print(f'\n❌ ERROR: {type(e).__name__}')
    print(f'   Details: {str(e)}')