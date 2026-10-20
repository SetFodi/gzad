interface QueryPage<T> {
  data: T[] | null
  error: { message: string } | null
}

/** Read every page of a stable ordered query, or fail without a partial total. */
export async function readAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  pageSize = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('Invalid page size')
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
