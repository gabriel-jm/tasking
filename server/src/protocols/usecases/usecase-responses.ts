export interface UseCaseSuccessResponse {
  ok: true,
  data: any
}

export interface UseCaseFailResponse {
  ok: false,
  error: string
}
