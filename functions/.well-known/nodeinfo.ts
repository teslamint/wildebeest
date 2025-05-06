import { cors } from 'wildebeest/backend/src/utils/cors'

const headers = {
	...cors(),
	'content-type': 'application/json',
	'cache-control': 'max-age=259200, public',
}

export const onRequest: PagesFunction<unknown, any> = async ({ request }) => {
	const domain = new URL(request.url).hostname
	return handleRequest(domain)
}

export async function handleRequest(domain: string): Promise<Response> {
	const res = null

	return new Response(JSON.stringify(res), { status: 410, statusText: 'Gone', headers })
}
