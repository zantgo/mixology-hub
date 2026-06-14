const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function runMigration() {
  console.log('🚀 Running database migration...');

  try {
    console.log('🔍 Checking database connection...');

    const { stdout, stderr } = await execAsync(
      'npx typeorm migration:run -d typeorm.config.ts',
      { cwd: __dirname },
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error('Error:', stderr);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log(
      '💡 Ensure PostgreSQL is running and the TypeORM datasource is configured correctly.',
    );
  }
}

runMigration();
