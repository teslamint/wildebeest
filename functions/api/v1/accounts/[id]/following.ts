// https://docs.joinmastodon.org/methods/accounts/#following

import { isLocalAccount } from 'wildebeest/backend/src/accounts'
import { Actor, getActorByMastodonId, getAndCache } from 'wildebeest/backend/src/activitypub/actors'
import { getFollowing, loadActors } from 'wildebeest/backend/src/activitypub/actors/follow'
import { type Database, getDatabase } from 'wildebeest/backend/src/database'
import { resourceNotFound } from 'wildebeest/backend/src/errors'
import { loadMastodonAccount } from 'wildebeest/backend/src/mastodon/account'
import { getFollowingId } from 'wildebeest/backend/src/mastodon/follow'
import type { ContextData, Env } from 'wildebeest/backend/src/types'
import { MastodonAccount } from 'wildebeest/backend/src/types/account'
import { cors, makeJsonResponse, MastodonApiResponse, readParams } from 'wildebeest/backend/src/utils'
import { actorToHandle } from 'wildebeest/backend/src/utils/handle'
import { z } from 'zod'

const schema = z.object({
	limit: z.coerce.number().int().min(1).max(80).catch(40),
})

type Dependencies = {
	domain: string
	db: Database
}

type Parameters = z.infer<typeof schema>

const headers = {
	...cors(),
	'content-type': 'application/json; charset=utf-8',
}

// TODO: support pagination
export const onRequestGet: PagesFunction<Env, 'id', ContextData> = async ({ params: { id }, request, env }) => {
	if (typeof id !== 'string') {
		return resourceNotFound('id', String(id))
	}
	const result = await readParams(request, schema)
	if (!result.success) {
		throw new Error('failed to read params')
	}
	const url = new URL(request.url)
	return handleRequest({ domain: url.hostname, db: await getDatabase(env) }, id, result.data)
}

export async function handleRequest(
	{ domain, db }: Dependencies,
	id: string,
	params: Parameters
): Promise<MastodonApiResponse<MastodonAccount[]>> {
	const actor = await getActorByMastodonId(db, id)
	if (!actor) {
		return resourceNotFound('id', id)
	}
	return await get(domain, db, actor, params)
}

async function get(
	domain: string,
	db: Database,
	actor: Actor,
	params: Parameters
): Promise<MastodonApiResponse<MastodonAccount[]>> {
	if (isLocalAccount(domain, actorToHandle(actor))) {
		const followingIds = await getFollowingId(db, actor, params.limit)
		const promises: Promise<MastodonAccount>[] = []
		for (const id of followingIds) {
			try {
				const followee = await getAndCache(new URL(id), db)
				promises.push(loadMastodonAccount(db, domain, followee, actorToHandle(followee)))
			} catch (err) {
				if (err instanceof Error) {
					console.warn(`failed to retrieve following (${id}): ${err.message}`)
				}
				throw err
			}
		}

		return makeJsonResponse(await Promise.all(promises), { headers })
	}

	const following = await loadActors(db, await getFollowing(actor, params.limit))
	const promises = following.map((followee) => {
		return loadMastodonAccount(db, domain, followee, actorToHandle(followee))
	})

	return makeJsonResponse(await Promise.all(promises), { headers })
}
