import { type Database, getDatabase } from 'wildebeest/backend/src/database'
import { getPublicTimeline, LocalPreference } from 'wildebeest/backend/src/mastodon/timeline'
import type { ContextData, Env } from 'wildebeest/backend/src/types'
import { cors } from 'wildebeest/backend/src/utils/cors'

const headers = {
	...cors(),
	'content-type': 'application/json; charset=utf-8',
}

export const onRequest: PagesFunction<Env, any, ContextData> = async ({ request, env }) => {
	const { searchParams } = new URL(request.url)
	const local = searchParams.get('local') === 'true'
	const remote = searchParams.get('remote') === 'true'
	const only_media = searchParams.get('only_media') === 'true'
	const offset = Number.parseInt(searchParams.get('offset') ?? '0')
	const domain = new URL(request.url).hostname
	return handleRequest(domain, await getDatabase(env), { local, remote, only_media, offset })
}

export async function handleRequest(
	domain: string,
	db: Database,
	// TODO: use only_media
	// eslint-disable-next-line unused-imports/no-unused-vars
	{ local = false, remote = false, only_media = false, offset = 0 } = {}
): Promise<Response> {
	let localParam = LocalPreference.NotSet
	if (local) {
		localParam = LocalPreference.OnlyLocal
	} else if (remote) {
		localParam = LocalPreference.OnlyRemote
	}

	// TODO - use only media option
	const statuses = await getPublicTimeline(domain, db, localParam, offset)
	return new Response(JSON.stringify(statuses), { headers })
}
