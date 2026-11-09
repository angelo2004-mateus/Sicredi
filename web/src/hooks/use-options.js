import { useQuery } from "@tanstack/react-query";
import { api, queryString } from "../services/api.js";

async function fetchOptions(resource, includeInactive) {
  const endpoint =
    resource === "partners" ? "/lookups/partners" : `/${resource}`;
  const rows = [];
  let page = 1;
  let total = Infinity;

  while (rows.length < total) {
    const response = await api(
      `${endpoint}${queryString({ page, page_size: 100 })}`,
    );

    rows.push(...response.data);
    total = response.pagination.total;
    page += 1;

    if (!response.data.length) break;
  }

  return includeInactive ? rows : rows.filter((row) => row.status === "active");
}

export function useOptions(resource, enabled = true, includeInactive = false) {
  return useQuery({
    queryKey: ["options", resource, includeInactive],
    queryFn: () => fetchOptions(resource, includeInactive),
    enabled,
  });
}
