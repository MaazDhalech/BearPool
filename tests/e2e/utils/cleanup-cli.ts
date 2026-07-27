// CLI wrapper around deleteRideByDestination, invoked from the CI workflow
// after each Maestro flow that posts a ride. Run via:
//   npx tsx tests/e2e/utils/cleanup-cli.ts <email> <password> <destination>
import { deleteRideByDestination } from "./cleanup";

const [, , email, password, destination] = process.argv;

if (!email || !password || !destination) {
  console.error("Usage: cleanup-cli.ts <email> <password> <destination>");
  process.exit(1);
}

deleteRideByDestination(email, password, destination);
