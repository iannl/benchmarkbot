#!/usr/bin/env node

// Copyright 2024, iannl. All rights reserved.


// DISCLAIMER:

// To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions 
// relating to this Program and the use of this Program (including, without limitation, any warranties implied by
// law in respect of satisfactory quality, fitness for purpose and/or the use of reasonable care and skill).
// Nothing in this disclaimer will:

// - limit or exclude our or your liability for death or personal injury resulting from negligence;
// - limit or exclude our or your liability for fraud or fraudulent misrepresentation;
// - limit any of our or your liabilities in any way that is not permitted under applicable law; or
// - exclude any of our or your liabilities that may not be excluded under applicable law.

// The limitations and exclusions of liability set out in this Section and elsewhere in this disclaimer: 
// (a) are subject to the preceding paragraph; and 
// (b) govern all liabilities arising under the disclaimer or in relation to the subject matter of this disclaimer, 
// including liabilities arising in contract, in tort (including negligence) and for breach of statutory duty.

// This Program is provided AS IS and We will not be liable for any loss or damage of any nature.


const util = require('util');
const exec = util.promisify(require('child_process').exec);
var colors = require('colors/safe')
var { version } = require('./package.json')
var fs = require("fs-extra");

var bconf = {
    cycles: 5,
    exclude: ['iris']
}

if (fs.existsSync(process.cwd() + '/bbconf.json')) {
    var oconf = JSON.parse(fs.readFileSync(process.cwd() + '/bbconf.json'))
    for (let c in oconf) {
        bconf[c] = oconf[c]
    }
}

var bdata = []
var bdatag = {}

async function main() {
    console.log(colors.bold(colors.blue('Running BenchmarkBot v' + version)))

    if (fs.existsSync(process.cwd() + '/benchmark.json')) {
        fs.rmSync('.bb_cache', { recursive: true, force: true })
        fs.copySync('src', '.bb_cache')

        var bmanifest = JSON.parse(fs.readFileSync(process.cwd() + '/benchmark.json'))

        for (let el of bconf.exclude) {
            delete bmanifest[el]
        }

        var blangs = Object.keys(bmanifest)

        var languageList = ""
        var lnum = 0

        for (let lang of blangs) {
            lnum++

            bdatag[bmanifest[lang].id] = {}

            bdatag[bmanifest[lang].id].id = bmanifest[lang].id
            bdatag[bmanifest[lang].id].language = bmanifest[lang].language

            bdatag[bmanifest[lang].id].cycles = 0
            bdatag[bmanifest[lang].id].totalBuildTime = 0
            bdatag[bmanifest[lang].id].totalRunTime = 0

            languageList += (lnum + ".").padEnd(4, " ") + colors.yellow(bmanifest[lang].language) + "\n"
        }

        console.log(colors.dim("\nBenchmarks will occur in this order:\n" + languageList))

        process.chdir('.bb_cache');

        for (let i = 0; i < bconf.cycles; i++) {
            console.log(colors.green('Starting cycle ' + (i + 1) + '/' + bconf.cycles))
            bdata[i] = {}
            for (let lang of blangs) {
                console.log(colors.blue('Testing ' + bmanifest[lang].language + '...'))
                await testlang(bmanifest[lang], i)
            }
        }

        process.chdir('..');

        bdatag.raw = bdata

        for (let e of bdata) {
            for (let eid in e) {
                let el = e[eid]
                if (el.buildTime) {
                    bdatag[eid].totalBuildTime += el.buildTime
                }
                if (el.runTime) {
                    bdatag[eid].cycles++
                    bdatag[eid].totalRunTime += el.runTime
                }
            }
        }
        for (let lid in bdatag) {
            let l = bdatag[lid]
            l.avgBuildTime = l.totalBuildTime / l.cycles
            l.avgRunTime = l.totalRunTime / l.cycles
        }

        console.log(colors.green('Done!'))
        fs.writeFileSync('bbout.json', JSON.stringify(bdatag, null, 4))
    } else {
        console.log(colors.red('File "benchmarkbot.json" doesn\'t exist in current working directory.'))
    }
}
main()

async function testlang(blang, cycle) {
    bdata[cycle][blang.id] = {
        id: blang.id,
        language: blang.language,
        buildTime: 0,
        runTime: NaN
    }

    try {
        var { stdout, stderr } = await exec(blang.prereq);

        if (stderr || !stdout) throw stderr


        if (blang.buildcmd) {
            let cmdt = Date.now()
            try {
                var { stdout, stderr } = await exec(blang.buildcmd);
                if (stderr) throw stderr
            } catch (err) {
                console.log(colors.red('Failed to build with error: ' + err))
            }
            bdata[cycle][blang.id].buildTime = Date.now() - cmdt
        }
        cmdt = Date.now()
        try {
            var { stdout, stderr } = await exec(blang.runcmd);
            if (stderr) throw stderr
        } catch (err) {
            console.log(colors.red('Failed to run with error: ' + err))
        }
        bdata[cycle][blang.id].runTime = Date.now() - cmdt

    } catch (e) {
        console.log(colors.red('Couldn\'t run ' + blang.language + ', missing prerequisites.'))
    }
}
