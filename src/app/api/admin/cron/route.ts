import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

const CRON_JOB_ORG_API_KEY = process.env.CRON_JOB_ORG_API_KEY || 'hlDGk9eyARRBgZb4UVqPb7x4mjH/nes66Nl0wM053Cc='
const CRON_JOB_ORG_API_URL = 'https://api.cron-job.org'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'
const CRON_SECRET = process.env.CRON_SECRET || 'qurantester-cron-secret'

// Get all cron jobs
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobs = await prisma.cronJob.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Get cron jobs error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Create/Setup cron job on cron-job.org
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, jobId } = body

    if (action === 'setup') {
      // Setup cron job on cron-job.org
      return await setupCronJobOrg()
    }

    if (action === 'toggle' && jobId) {
      return await toggleJob(jobId)
    }

    if (action === 'sync') {
      return await syncWithCronJobOrg()
    }

    if (action === 'run' && jobId) {
      return await runJobManually(jobId)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Cron action error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function setupCronJobOrg() {
  const url = `${BASE_URL}/api/cron/cleanup-messages?secret=${CRON_SECRET}`

  // Create job on cron-job.org
  const response = await fetch(`${CRON_JOB_ORG_API_URL}/jobs`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CRON_JOB_ORG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job: {
        title: 'QuranTester - Cleanup Messages',
        url: url,
        enabled: true,
        saveResponses: true,
        schedule: {
          timezone: 'Europe/Moscow',
          expiresAt: 0,
          hours: [-1], // Every hour
          mdays: [-1], // Every day of month
          minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], // Every 5 mins
          months: [-1], // Every month
          wdays: [-1], // Every day of week
        },
        requestMethod: 0, // GET
        extendedData: {
          headers: {},
          body: '',
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('cron-job.org API error:', error)
    return NextResponse.json({
      error: 'Failed to create cron job on cron-job.org',
      details: error,
    }, { status: 500 })
  }

  const result = await response.json()
  const externalId = result.jobId?.toString()

  // Save to database
  const job = await prisma.cronJob.upsert({
    where: { name: 'cleanup-messages' },
    update: {
      externalId,
      url,
      schedule: '*/5 * * * *',
      isEnabled: true,
    },
    create: {
      name: 'cleanup-messages',
      externalId,
      url,
      schedule: '*/5 * * * *',
      isEnabled: true,
    },
  })

  return NextResponse.json({
    success: true,
    job,
    externalId,
  })
}

async function toggleJob(jobId: string) {
  const job = await prisma.cronJob.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const newEnabled = !job.isEnabled

  // Update on cron-job.org if we have external ID
  if (job.externalId) {
    try {
      await fetch(`${CRON_JOB_ORG_API_URL}/jobs/${job.externalId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CRON_JOB_ORG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job: {
            enabled: newEnabled,
          },
        }),
      })
    } catch (error) {
      console.error('Failed to update cron-job.org:', error)
    }
  }

  // Update in database
  const updatedJob = await prisma.cronJob.update({
    where: { id: jobId },
    data: { isEnabled: newEnabled },
  })

  return NextResponse.json({ success: true, job: updatedJob })
}

async function syncWithCronJobOrg() {
  // Get jobs from cron-job.org
  const response = await fetch(`${CRON_JOB_ORG_API_URL}/jobs`, {
    headers: {
      'Authorization': `Bearer ${CRON_JOB_ORG_API_KEY}`,
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch from cron-job.org' }, { status: 500 })
  }

  const data = await response.json()
  const externalJobs = data.jobs || []

  // Filter only our jobs (containing qurantester in URL)
  const ourJobs = externalJobs.filter((j: any) =>
    j.url?.includes('qurantester') || j.title?.includes('QuranTester')
  )

  return NextResponse.json({
    success: true,
    externalJobs: ourJobs,
    total: ourJobs.length,
  })
}

async function runJobManually(jobId: string) {
  const job = await prisma.cronJob.findUnique({
    where: { id: jobId },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Call the job URL directly
  try {
    const jobUrl = new URL(job.url, BASE_URL)
    jobUrl.searchParams.set('secret', CRON_SECRET)

    const response = await fetch(jobUrl.toString())
    const result = await response.json()

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to run job',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
