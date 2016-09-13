# axCutHost

A client/server host control and GCode generation tool originally developed for the axCut laser cutter, but now being reworked into a more generic tool.  Works in partnership with the Marlin_for_axCut firmware.

## Features

* Full featured web UI - access from any modern device (laptop, tablet, phone)
* Headless host control (designed to run on a RPi or similar)
* Comprehensive manual control, GCode with command reference & ability to include custom GCode routines
* Material library - defining cut settings for various cut types
* Import SVG files to generate G-Code, auto mapping colors to cut-types for a selected material
* Sophisticated path optimisation to minimise job time
* Automatic sequencing of cuts for interior shapes (i.e. remove cutouts first)
* GCode editor, with realtime visualition and simulation
* Suite of extensible calibration wizards for use in setup or testing new materials
* Power Map - dynamically vary the power levels across the laser bed to compensate for beam divergence, etc (useful for large format machines)
* Live status update and time-remaining feedback from the laser cutter
* Pause/resume and Abort functions


# System Architecture

* UI - Fat web client (javascript, etc), with AJAX driven comms to/from web server
* Web server / serial control - Python-based server-side, using embedded bottle.py web server and serial communication to laser cutter
* Marlin-based firmware - communicates G/M-codes in plain text over serial link, protected by enhanced CRC16 error detection


# Launching the Host

The Python-based host includes a lightweight web-server (bottle.py) and has no external library dependencies, launching it is as simple as:

1) clone the repo
2) terminal to the root directory
3) execute run.sh
4) navigate to http://localhost:4444 (Chrome browser recommended)
