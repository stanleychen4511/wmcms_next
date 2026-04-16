import { NextRequest, NextResponse } from 'next/server';
import { fetchSchedules, executeSchedule } from '../../../actions/notificationActions';

export async function GET(req: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...6=Sat

    const schedulesRes = await fetchSchedules();
    if (!schedulesRes.success || !schedulesRes.data) {
        return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 });
    }

    const results: { id: number; name: string; sent: number; failed: number }[] = [];

    for (const schedule of schedulesRes.data) {
        if (!schedule.is_active) continue;

        // Check if today matches the schedule
        let shouldRun = false;
        if (schedule.frequency === 'daily') {
            shouldRun = true;
        } else if (schedule.frequency === 'weekly' && schedule.day_of_week === dayOfWeek) {
            shouldRun = true;
        }

        if (!shouldRun) continue;

        const result = await executeSchedule(schedule.id, 'cron');
        results.push({ id: schedule.id, name: schedule.name, sent: result.sent, failed: result.failed });
    }

    return NextResponse.json({ success: true, date: today.toISOString(), results });
}
