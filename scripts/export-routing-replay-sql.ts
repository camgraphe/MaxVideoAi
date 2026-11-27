// Pipe stdout into OUTREACH/scripts/read_v2_sql.py with --env-file and --admin-exclusions.
// The Python reader binds :admin_ids, uses BEGIN READ ONLY and limits execution time.
import { HISTORICAL_REPLAY_QUERY, assertHistoricalReplayWindow } from '../frontend/app/(core)/admin/routing/_lib/historical-replay-query';

const [startDay, endDay] = process.argv.slice(2);
assertHistoricalReplayWindow(startDay, endDay);
process.stdout.write(HISTORICAL_REPLAY_QUERY.replace('$1', "'" + startDay + "'").replace('$2', "'" + endDay + "'").replace('$3::text[]', ':admin_ids') + '\n');
