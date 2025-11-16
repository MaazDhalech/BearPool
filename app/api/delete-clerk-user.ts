// app/api/delete-clerk-user/route.ts (or pages/api/delete-clerk-user.ts)
import { auth } from '@clerk/clerk-sdk-node';

export async function POST(request: Request) {
  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
  }

  try {
    await auth.users.deleteUser(userId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Clerk delete error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete user' }), { status: 500 });
  }
}