export const average = (arr:number[]):number => {
  if (arr.length === 0) return 0
  return arr.reduce((res:number, item:number) => item + res, 0) / arr.length
}
