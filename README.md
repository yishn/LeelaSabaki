# LeelaSabaki

[Leela (Zero)](https://www.sjeng.org/leela.html) integration with [Sabaki](http://sabaki.yichuanshen.de).

![Screenshot](./screenshot.png)

## Features

- Shows heatmap of network probabilities
- Adds considered variations to the game tree in Sabaki, along with winning statistics

## Installation

- Make sure you have the engine only version of [Leela](https://www.sjeng.org/leela.html) or [Leela Zero](https://github.com/gcp/leela-zero).
- Make sure you have the [most recent version of Sabaki](https://github.com/SabakiHQ/Sabaki/releases/latest) installed.
- [Download LeelaSabaki](https://github.com/SabakiHQ/LeelaSabaki/releases), or [build it yourself](#building). Make sure you have permission to execute the files.
- Open Sabaki and open the 'Preferences' drawer by pressing <kbd>Ctrl/Cmd</kbd>+<kbd>,</kbd>.
- Click on the 'Engines' tab and add a new engine with the following settings:
  - **Path:** Your path to LeelaSabaki
  - **Arguments:** [LeelaSabaki options](#options), followed by your path to Leela (Zero), followed by additional command line arguments to Leela. Leela will be called with the `--gtp` option automatically. If you're using Leela Zero, make sure to configure it properly.
- **Example**
  - **Path:** `leelasabaki`
  - **Arguments:** `--heatmap my_path/leelaz -w my_path/weights --playouts 100 --noponder`

## CLI Manual

### Usage

~~~
$ leelasabaki [--flat] [--heatmap] [--help] <path-to-leela> [leela-arguments...]
~~~

### Options

- #### `--flat`

  Instead of appending variations as multiple moves, we will append one node per variation with the final board arrangement and move numbers.

- #### `--heatmap`

  Visualizes network probabilities as a heatmap after each generated move.

- #### `--help`

  Displays help message.

## Building

Make sure you have [Node.js](https://nodejs.org/) and npm installed. First, clone LeelaSabaki:

~~~
$ git clone https://github.com/SabakiHQ/LeelaSabaki.git
$ cd LeelaSabaki
~~~

Install the dependencies of LeelaSabaki with npm:

~~~
$ npm install
~~~

To build binaries use the following command:

~~~
$ npm run build
~~~

This will create an executable file in `/bin`.
