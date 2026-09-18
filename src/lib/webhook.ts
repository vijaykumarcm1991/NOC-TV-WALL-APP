import { PRIORITY_META } from '@/lib/noc-types'
import type { NocUpdate } from '@/lib/noc-types'

/**
 * Send a NOC update notification to a Slack-compatible incoming webhook.
 * Works with Slack, Microsoft Teams (via Slack-compatible webhook connector),
 * Discord (via Slack-compatible webhook), and Mattermost.
 *
 * Silently no-ops if no webhook URL is configured.
 */
export async function sendUpdateWebhook(
  update: NocUpdate,
  webhookUrl: string | undefined | null,
  eventName: 'created' | 'resolved' | 'reactivated' | 'deleted' = 'created',
): Promise<void> {
  if (!webhookUrl) return
  try {
    const meta = PRIORITY_META[update.priority]
    const base = process.env.NEXTAUTH_URL || process.env.PUBLIC_URL || ''
    const wallUrl = base ? `${base}/?view=wall` : ''

    const eventLabels = {
      created: 'New update posted',
      resolved: 'Update resolved',
      reactivated: 'Update reactivated',
      deleted: 'Update deleted',
    }

    const emoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅',
    }[update.priority]

    // Slack Block Kit payload (also rendered as a fallback text by Teams)
    const payload = {
      text: `${emoji} ${eventLabels[eventName]}: ${update.title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${eventLabels[eventName]}`,
          },
        },
        {
          type: 'section',
          block_id: 'title',
          text: {
            type: 'mrkdwn',
            text: `*${update.title}*`,
          },
        },
        {
          type: 'section',
          block_id: 'body',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Priority*\n${meta.label}`,
            },
            {
              type: 'mrkdwn',
              text: `*Category*\n${update.category}`,
            },
            {
              type: 'mrkdwn',
              text: `*Posted by*\n${update.authorName}${update.source ? ` · ${update.source}` : ''}`,
            },
            {
              type: 'mrkdwn',
              text: `*When*\n${new Date(update.createdAt).toISOString()}`,
            },
          ],
        },
        {
          type: 'section',
          block_id: 'content',
          text: {
            type: 'mrkdwn',
            text: update.content,
          },
        },
        ...(wallUrl
          ? [
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'View on Wall',
                    },
                    url: wallUrl,
                  },
                ],
              },
            ]
          : []),
      ],
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(
        `[webhook] failed to deliver update ${update.id}: ${res.status} ${res.statusText}`,
      )
    }
  } catch (err) {
    console.error(`[webhook] error delivering update ${update.id}:`, err)
  }
}
