// https://docs.joinmastodon.org/methods/oauth/#token

import { type Database, getDatabase } from 'wildebeest/backend/src/database'
import * as errors from 'wildebeest/backend/src/errors'
import { getClientById } from 'wildebeest/backend/src/mastodon/client'
import type { Env } from 'wildebeest/backend/src/types/env'
import { makeReadBody } from 'wildebeest/backend/src/utils/body'
import { cors } from 'wildebeest/backend/src/utils/cors'

type Body = {
	code: string | null
}

const readBody = makeReadBody<{ code?: string }>({ code: 'string' })

const headers = {
	...cors(),
	'content-type': 'application/json; charset=utf-8',
}

export const onRequest: PagesFunction<Env, any> = async ({ request, env }) => {
	return handleRequest(await getDatabase(env), request)
}

export async function handleRequest(db: Database, request: Request): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return new Response('', { headers })
	}

	let code: Body['code'] = null
	try {
		const body = await readBody(request)
		if (body.code) {
			code = body.code
		}
	} catch (err) {
		// ignore error
	}

	if (!code) {
		const url = new URL(request.url)
		code = url.searchParams.get('code')
	}
	if (!code) {
		return errors.notAuthorized('missing authorization')
	}

	const parts = code.split('.')
	const clientId = parts[0]

	const client = await getClientById(db, clientId)
	if (client === null) {
		return errors.clientUnknown()
	}

	const res = {
		access_token: code,
		token_type: 'Bearer',
		scope: client.scopes,
		created_at: (Date.now() / 1000) | 0,
	}
	return new Response(JSON.stringify(res), { headers })
}
