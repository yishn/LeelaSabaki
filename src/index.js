const pkg = require('../package')
const fs = require('fs')
const readline = require('readline')
const {Controller, Command, Response} = require('@sabaki/gtp')
const {coord2point} = require('./sgf')
const StderrLogger = require('./StderrLogger')

let leelaArgIndex = process.argv.findIndex((x, i) => i >= 2 && x.indexOf('-') !== 0)
let globalArgs = process.argv.slice(2, leelaArgIndex)

if (leelaArgIndex < 0 || globalArgs.includes('--help')) return console.log(`
    ${pkg.productName} v${pkg.version}

       USAGE:
        ${pkg.name} [--flat] [--heatmap] [--black] [--white] [--limitdepth] [--labels] [--help] <path-to-leela> [leela-arguments...]

    OPTIONS:
        --flat
            Instead of appending variations as multiple moves, we will append one
            node per variation with the final board arrangement and move numbers.

        --heatmap
            Visualizes network probabilities as a heatmap after each generated move.
        
        --black
            Include black variations

        --white
            Include white variations

        --limitdepth
            Truncate variations to a depth of 7

        --labels
            Display labels for variations A, B, C, ...

        --help
            Shows this help message.
`)

let lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
})

let [leelaPath, ...leelaArgs] = [...process.argv.slice(leelaArgIndex)]
if (!leelaArgs.includes('--gtp')) leelaArgs.push('--gtp')

let controller = new Controller(leelaPath, leelaArgs)
let stderrLogger = new StderrLogger(controller)
let enableStderrRelay = true

let state = {
    size: 19,
    genmoveColor: 'B'
}

let depth = globalArgs.includes('--limitdepth') ? 7 : 21

controller.start()
controller.process.on('exit', code => process.exit(code))
controller.on('stderr', ({content}) => enableStderrRelay && process.stderr.write(content + '\n'))

function log2labels(log) {
    let lines = log.split('\n')

    let startIndex = lines.findIndex(line => line.includes('MC winrate=') || line.includes('NN eval='))
    if (startIndex < 0) startIndex = 0

    return lines
        .slice(startIndex)
        .filter(line => line.includes('->'))
        .map(line => line.slice(line.indexOf('PV: ') + 4).trim().split(/\s+/))
        .filter(line => line.length >= 4)
        .map(line => line.slice(0,1))
        .join(';')
}

function log2variations(log) {
    let lines = log.split('\n')

    let startIndex = lines.findIndex(line => line.includes('MC winrate=') || line.includes('NN eval='))
    if (startIndex < 0) startIndex = 0

    let colors = [state.genmoveColor, state.genmoveColor === 'B' ? 'W' : 'B']

    return lines
        .slice(startIndex)
        .filter(line => line.includes('->'))
        .map(line => ({
            visits: +line.slice(line.indexOf('->') + 2, line.indexOf('(')).trim(),
            stats: line.slice(line.indexOf('('), line.indexOf('PV: ')).trim()
                .replace(/\s+/g, ' ').slice(1, -1).split(') (')
                .reduce((acc, x) => Object.assign(acc, {[x[0]]: x.slice(x.indexOf(':') + 2)}), {}),
            variation: line.slice(line.indexOf('PV: ') + 4).trim().split(/\s+/)
                .slice(0, depth)
        }))
        .filter(({visits, variation}) => variation.length >= 4)
        .map(({visits, stats, variation}) =>
            `(;C[${
                [
                    `- \`${visits}\` visits`,
                    Object.keys(stats).map(key => `  - **${key}** \`${stats[key]}\``).join('\n')
                ].join('\n')
            }]${
                globalArgs.includes('--flat')

                ? variation.reduce(([AB, AW, LB], x, i) => {
                    let list = colors[i % 2] === 'B' ? AB : AW
                    let point = coord2point(x, state.size)

                    if (point !== '') {
                        list.push(point)
                        LB.push(`${point}:${i + 1}`)
                    }

                    return [AB, AW, LB]
                }, [[], [], []]).map((list, i) =>
                    `${['AB', 'AW', 'LB'][i]}[${list.join('][')}]`
                ).join('')

                : variation
                .map((x, i) => `${colors[i % 2]}[${coord2point(x, state.size)}]`)
                .join(';')
            })`
        )
        .join('')
}

function log2heatmap(log) {
    let lines = log.split('\n')

    let startIndex = lines.findIndex(line => line.match(/^\s*(\d+\s+)+$/) != null)
    if (startIndex < 0) startIndex = lines.length

    let data = lines.slice(startIndex, startIndex + state.size)
        .map(line => line.trim().split(/\s+/).map(x => +x))
    let max = Math.max(...data.map(x => Math.max(...x)))

    return data.map(x => x.map(y => Math.floor(y * 9.9 / max)))
}

async function handleInput(input) {
    let {id, name, args} = Command.fromString(input)
    if (id == null) id = ''

    if (['genmove', 'heatmap', 'play'].includes(name)) stderrLogger.start()

    if (name === 'sabaki-genmovelog') {
        let variations = []
        let labels = []

        // Do variations and labels
        if ((globalArgs.includes('--black') & state.genmoveColor === 'B') ||
            (globalArgs.includes('--white') & state.genmoveColor === 'W')) {

            variations = log2variations(stderrLogger.log)
            
            if (globalArgs.includes('--labels')) { 
                labels = log2labels(stderrLogger.log)
                if (labels.length > 0) {
                    let alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                    labels = labels.split(';')
                        .map((x, i) => coord2point(x, state.size) + ":" + alpha[Math.min(i, alpha.length - 1)])
                        .join(';')
                }
            }
        }

        let json = {variations}
        json.labels = labels
        
        if (globalArgs.includes('--heatmap')) {
            enableStderrRelay = false
            let result = await handleInput('heatmap')
            enableStderrRelay = true

            let {heatmap} = JSON.parse(result.match(/#sabaki(.*)/)[1])
            json.heatmap = heatmap
        }

        return `=${id} #sabaki${JSON.stringify(json)}\n\n`
    } else if (name === 'known_command' && args[0] === 'sabaki-genmovelog') {
        return `=${id} true\n\n`
    } else if (name === 'heatmap') {
        await Promise.all([
            new Promise(resolve => {
                let counter = state.size
                let dataHandler = ({content}) => {
                    if (content.match(/^\s*(\d+\s+)+$/) != null) {
                        counter--
                    }

                    if (counter === 0) {
                        controller.removeListener('stderr', dataHandler)
                        resolve()
                    }
                }

                controller.on('stderr', dataHandler)
            }),
            controller.sendCommand({name: 'heatmap'})
        ])

        let heatmap = log2heatmap(stderrLogger.log)
        return `=${id} #sabaki${JSON.stringify({heatmap})}\n\n`
    }

    let response = await controller.sendCommand(Command.fromString(input))

    if (['genmove', 'play'].includes(name)) {
        stderrLogger.stop()
        if (!response.error) state.genmoveColor = args[0][0].toUpperCase()
    } else if (name === 'list_commands') {
        if (!response.error) response.content += '\nsabaki-genmovelog'
    } else if (name === 'boardsize') {
        if (!response.error) state.size = +args[0]
    }

    return Response.toString(response) + '\n\n'
}

lineReader.on('line', async input => {
    process.stdout.write(await handleInput(input))
})

lineReader.prompt()
