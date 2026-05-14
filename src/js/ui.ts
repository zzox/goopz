export const $id = (str:string) => document.getElementById(str)!

export const setAndUpdateNum = (id:string, value:number, cb:(n:number) => void) => {
  const item = $id(id) as HTMLInputElement
  if (!item) {
    console.warn(`no item with id ${id} found`)
    return
  }

  item.onchange = (event) => {
    // @ts-ignore
    const val = parseFloat(event.target!.value)
    if (!isNaN(val)) {
      cb(val)
    }
  }

  item.value = value + ''
}
