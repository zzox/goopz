export const keys = new Map<string, boolean>()
export const justPressed = new Map<string, boolean>()

export const clearJustPressed = () => {
  justPressed.clear()
}
