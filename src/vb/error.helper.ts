export class CurrentPriceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CurrentPriceError'
  }
}
