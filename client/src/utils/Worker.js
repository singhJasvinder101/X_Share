const array = []

self.addEventListener('message', (e) => {
    if (e.data !== "download") {
        array.push(e.data)
    } else {
        const blob = new Blob(array, { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        self.postMessage(url)
        array = []
    }
})
