/*jshint nomen:false */
/*globals require, __dirname, module */

'use strict';

var path, fs, render, packageInfo, numbers, charts,
    chartWidth, chartMargin, chartPadding,
    barHeight, barPadding, labelOffset;

path = require('path');
fs = require('fs');
render = require('handlebars').compile(
    fs.readFileSync(
        path.join(__dirname, 'template.html')
    ),
    { encoding: 'utf8' }
);
packageInfo = require('../../../package.json');

numbers = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen'
];

charts = [
    {
        view: 'first',
        key: 'speedIndex',
        title: 'Speed index, first view',
        label: 'First-view speed index (lower is better)'
    },
    {
        view: 'repeat',
        key: 'speedIndex',
        title: 'Speed index, repeat view',
        label: 'Repeat-view speed index (lower is better)'
    },
    {
        view: [ 'repeat', 'first' ],
        key: 'speedIndex',
        derivative: 'percentage',
        title: 'Speed index, repeat-view improvement',
        label: 'Repeat-view speed index as a percentage of first-view (lower is better)'
    },
    {
        view: 'first',
        key: 'firstByte',
        title: 'First byte',
        label: 'Time to first byte (milliseconds)'
    },
    {
        view: 'first',
        key: [ 'startRender', 'firstByte' ],
        derivative: 'difference',
        title: 'Start render, difference from first byte',
        label: 'Time from first byte until start render (milliseconds)'
    },
    {
        view: 'first',
        key: [ 'load', 'firstByte' ],
        derivative: 'difference',
        title: 'Load, difference from first byte',
        label: 'Time from first byte until load event (milliseconds)'
    }
];

chartWidth = 832;
chartMargin = 140;
chartPadding = 29;
barHeight = 32;
barPadding = 2;
labelOffset = 16;

module.exports = {
    map: map
};

function map (options, results) {
    return render(mapResults(options, results));
}

function mapResults (options, results) {
    var date, locationParts;

    date = new Date();
    locationParts = options.location.split(':');

    return {
        application: packageInfo.name,
        version: packageInfo.version,
        date: date.toLocaleDateString(),
        count: numbers[options.count],
        location: locationParts[0],
        connection: options.connection,
        userAgent: locationParts[1],
        times: {
            begin: results.times.begin.toLocaleTimeString(),
            end: results.times.end.toLocaleTimeString() + ' on ' + results.times.end.toLocaleDateString()
        },
        results: results.map(mapResult),
        charts: charts.map(mapChart.bind(null, results)),
        chartWidth: chartWidth,
        chartMargin: chartMargin,
        barHeight: barHeight,
        labelOffset: labelOffset,
        xAxis: {
            offset: results.length * (barHeight + barPadding) + 1,
            width: chartWidth - chartMargin + 2,
            labelPosition: Math.round((chartWidth - chartMargin + 2) / 2)
        }
    };
}

function mapResult (result) {
    var clone = JSON.parse(JSON.stringify(result));

    Object.keys(result.firstView).forEach(function (key) {
        formatValue(clone.firstView[key]);

        if (clone.repeatView[key]) {
            formatValue(clone.repeatView[key]);
        }
    });

    return clone;
}

function formatValue (datum) {
    datum.value = formatInteger(datum.value);
}

function formatInteger (number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function mapChart (results, chart) {
    return {
        title: chart.title,
        height: results.length * (barHeight + barPadding) + chartPadding,
        yAxisHeight: results.length * (barHeight + barPadding) + barPadding,
        tests: results.sort(
            compareResults.bind(null, chart.view, chart.key, chart.derivative)
        ).map(
            mapChartResult.bind(
                null,
                chart.view,
                chart.key,
                chart.derivative,
                getMaximumValue(chart.view, chart.key, chart.derivative, results) / (chartWidth - chartMargin)
            )
        ),
        label: chart.label
    };
}

barPadding = 2;
chartPadding = 29;

function compareResults (view, chartKey, derivative, first, second) {
    return getValue(view, chartKey, derivative, first) - getValue(view, chartKey, derivative, second);
}

function getValue (view, chartKey, derivative, result) {
    if (derivative) {
        return getDerivativeValue(view, chartKey, result, derivative);
    }

    return getSimpleValue(view, chartKey, result);
}

function getDerivativeValue (view, chartKey, result, derivative) {
    var operands = getDerivativeOperands(view, chartKey, result);

    if (derivative === 'difference') {
        return operands.lhs.value - operands.rhs.value;
    }

    if (derivative === 'percentage') {
        return Math.round((operands.lhs.value / operands.rhs.value) * 100);
    }

    throw new Error('unrecognised derivative `' + derivative + '`');
}

function getDerivativeOperands (view, chartKey, result) {
    var lhs, rhs;

    if (Array.isArray(view)) {
        lhs = getViewResult(view[0], result);
        rhs = getViewResult(view[1], result);
    } else {
        lhs = rhs = getViewResult(view, result);
    }

    if (Array.isArray(chartKey)) {
        lhs = lhs[chartKey[0]];
        rhs = rhs[chartKey[1]];
    } else {
        lhs = lhs[chartKey];
        rhs = rhs[chartKey];
    }

    return { lhs: lhs, rhs: rhs };
}

function getViewResult (view, result) {
    return result[view + 'View'];
}

function getSimpleValue (view, chartKey, result) {
    return getViewResult(view, result)[chartKey].value;
}

function getMaximumValue (view, chartKey, derivative, results) {
    return results.reduce(function (maximum, result) {
        var current = getValue(view, chartKey, derivative, result);

        if (current > maximum) {
            return current;
        }

        return maximum;
    }, 0);
}

function mapChartResult (view, chartKey, derivative, millisecondsPerPixel, result, index) {
    var value, barWidth, textOrientation, textClass, textAnchor;

    value = getValue(view, chartKey, derivative, result);
    barWidth = value / millisecondsPerPixel;

    if (barWidth % 1 !== 0) {
        barWidth = barWidth.toFixed(2);
    }

    textOrientation = '';
    textClass = 'chart-label';

    if (barWidth < 40) {
        textAnchor = 'start';
    } else {
        textOrientation = '-';
        textClass += ' chart-bar-label';
        textAnchor = 'end';
    }

    return {
        offset: index * (barHeight + barPadding),
        name: result.name,
        type: result.type,
        barWidth: barWidth,
        value: formatInteger(value) + (derivative === 'percentage' ? '%' : ''),
        textOrientation: textOrientation,
        textClass: textClass,
        textAnchor: textAnchor
    };
}

