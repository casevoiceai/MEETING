const testDriveConnection = async () => {
  try {
    console.log('[DRIVE] connection check starting...');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.error('[DRIVE] no session token');
      return 'error';
    }

    console.log('[DRIVE] sending token');

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'status_check' }),
      }
    );

    if (!res.ok) {
      console.error('[DRIVE] HTTP fail', res.status);
      return res.status === 401 ? 'warning' : 'error';
    }

    const data = await res.json();

    console.log('[DRIVE] success', data);

    return 'healthy';
  } catch (err) {
    console.error('[DRIVE] connection failed:', err);
    return 'error';
  }
};
