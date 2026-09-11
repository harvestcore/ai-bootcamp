// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, and "" escapes.
// Rebrickable's exports don't use embedded newlines inside fields, so this stays simple.
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = splitLine(lines[0])
  const rows = new Array(lines.length - 1)
  for (let i = 1; i < lines.length; i++) {
    rows[i - 1] = splitLine(lines[i])
  }
  return { header, rows }
}

function splitLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      fields.push(field)
      field = ''
    } else {
      field += c
    }
  }
  fields.push(field)
  return fields
}
