/* eslint-disable no-trailing-spaces */

class SVGFunnel {
    constructor(options) {
        this.createContainer(options);
        this.color = options.data.colors || '#FFB178';
        this.fillMode = (typeof this.color === 'object') ? 'gradient' : 'solid';
        this.gradientDirection = (options.gradientDirection && options.gradientDirection === 'vertical')
            ? 'vertical'
            : 'horizontal';
        this.direction = (options.direction && options.direction === 'vertical') ? 'vertical' : 'horizontal';
        this.labels = SVGFunnel.getLabels(options);
        this.values = SVGFunnel.getValues(options);
        this.percentages = this.createPercentages();

        this.draw();
    }

    /**
    An example of a two-dimensional funnel graph
    #0..................
                       ...#1................
                                           ......
    #0********************#1**                    #2.........................#3 (A)
                              *******************
                                                  #2*************************#3 (B)
                                                  #2+++++++++++++++++++++++++#3 (C)
                              +++++++++++++++++++
    #0++++++++++++++++++++#1++                    #2-------------------------#3 (D)
                                           ------
                       ---#1----------------
    #0-----------------

     Main axis is the primary axis of the graph.
     In a horizontal graph it's the X axis, and Y is the cross axis.
     However we use the names "main" and "cross" axis,
     because in a vertical graph the primary axis is the Y axis
     and the cross axis is the X axis.

     First step of drawing the funnel graph is getting the coordinates of points,
     that are used when drawing the paths.

     There are 4 paths in the example above: A, B, C and D.
     Such funnel has 3 labels and 3 subLabels.
     This means that the main axis has 4 points (number of labels + 1)
     One the ASCII illustrated graph above, those points are illustrated with a # symbol.

    */
    getMainAxisPoints() {
        const size = this.getDataSize();
        const points = [];
        const dimension = this.direction === 'vertical' ? this.getHeight() : this.getWidth();
        for (let i = 0; i <= size; i++) {
            points.push(SVGFunnel.roundPoint(dimension * i / size));
        }
        return points;
    }

    getCrossAxisPoints() {
        const points = [];
        const fullDimension = this.direction === 'vertical' ? this.getWidth() : this.getHeight();
        // get half of the graph container height or width, since funnel shape is symmetric
        // we use this when calculating the "A" shape
        const dimension = fullDimension / 2;
        if (this.is2d()) {
            const totalValues = this.getValues2d();
            const max = Math.max(...totalValues);

            // duplicate last value
            totalValues.push([...totalValues].pop());
            // get points for path "A"
            points.push(totalValues.map(value => SVGFunnel.roundPoint((max - value) / max * dimension)));
            // percentages with duplicated last value
            const percentagesFull = this.getPercentages2d();
            const pointsOfFirstPath = points[0];

            for (let i = 1; i < this.getSubDataSize(); i++) {
                const p = points[i - 1];
                const newPoints = [];

                for (let j = 0; j < this.getDataSize(); j++) {
                    newPoints.push(SVGFunnel.roundPoint(
                        // eslint-disable-next-line comma-dangle
                        p[j] + (fullDimension - pointsOfFirstPath[j] * 2) * (percentagesFull[j][i - 1] / 100)
                    ));
                }

                // duplicate the last value as points #2 and #3 have the same value on the cross axis
                newPoints.push([...newPoints].pop());
                points.push(newPoints);
            }

            // add points for path "D", that is simply the "inverted" path "A"
            points.push(pointsOfFirstPath.map(point => fullDimension - point));
        } else {
            // As you can see on the visualization above points #2 and #3 have the same cross axis coordinate
            // so we duplicate the last value
            const max = Math.max(...this.values);
            const values = [...this.values].concat([...this.values].pop());
            // if the graph is simple (not two-dimensional) then we have only paths "A" and "D"
            // which are symmetric. So we get the points for "A" and then get points for "D" by subtracting "A"
            // points from graph cross dimension length
            points.push(values.map(value => SVGFunnel.roundPoint((max - value) / max * dimension)));
            points.push(points[0].map(point => fullDimension - point));
        }

        return points;
    }

    getGraphType() {
        return this.values && this.values[0] instanceof Array ? '2d' : 'normal';
    }

    is2d() {
        return this.getGraphType() === '2d';
    }

    getDataSize() {
        return this.values.length;
    }

    getSubDataSize() {
        return this.values[0].length;
    }

    static getLabels(options) {
        if (!options.data) {
            throw new Error('Data is missing');
        }

        const { data } = options;

        if (typeof data.labels === 'undefined') return [];

        return data.labels;
    }

    addLabels() {
        this.container.style.position = 'relative';

        const holder = document.createElement('div');
        holder.setAttribute('class', 'svg-funnel-js__labels');

        this.percentages.forEach((percentage, index) => {
            const labelElement = document.createElement('div');
            labelElement.setAttribute('class', `svg-funnel-js__label label-${index + 1}`);

            const title = document.createElement('div');
            title.setAttribute('class', 'label__title');
            title.textContent = this.labels[index] || '';

            const value = document.createElement('div');
            value.setAttribute('class', 'label__value');

            const valueNumber = this.is2d() ? this.getValues2d()[index] : this.values[index];
            value.textContent = SVGFunnel.formatNumber(valueNumber);

            const percentageValue = document.createElement('div');
            percentageValue.setAttribute('class', 'label__percentage');

            if (percentage !== 100) {
                percentageValue.textContent = `${percentage.toString()}%`;
            }

            labelElement.appendChild(title);
            labelElement.appendChild(value);
            labelElement.appendChild(percentageValue);

            holder.appendChild(labelElement);
        });

        this.container.appendChild(holder);
    }

    createContainer(options) {
        if (!options.container) {
            throw new Error('Container is missing');
        }

        this.container = document.querySelector(options.container);
        this.container.classList.add('svg-funnel-js');

        if (options.direction === 'vertical') {
            this.container.classList.add('svg-funnel-js--vertical');
        }
    }

    static getValues(options) {
        if (!options.data) {
            return [];
        }

        const { data } = options;

        if (data instanceof Array) {
            if (Number.isInteger(data[0])) {
                return data;
            }
            return data.map(item => item.value);
        }
        if (typeof data === 'object') {
            return options.data.values;
        }

        return [];
    }

    getValues2d() {
        const values = [];

        this.values.forEach((valueSet) => {
            values.push(valueSet.reduce((sum, value) => sum + value, 0));
        });

        return values;
    }

    getPercentages2d() {
        const percentages = [];

        this.values.forEach((valueSet) => {
            const total = valueSet.reduce((sum, value) => sum + value, 0);
            percentages.push(valueSet.map(value => SVGFunnel.roundPoint(value * 100 / total)));
        });

        return percentages;
    }

    createPercentages() {
        let values = [];

        if (this.is2d()) {
            values = this.getValues2d();
        } else {
            values = [...this.values];
        }

        const max = Math.max(...values);
        return values.map(value => SVGFunnel.roundPoint(value * 100 / max));
    }

    static createSVGElement(element, container, attributes) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', element);

        if (typeof attributes === 'object') {
            SVGFunnel.setAttrs(el, attributes);
        }

        if (typeof container !== 'undefined') {
            container.appendChild(el);
        }

        return el;
    }

    static roundPoint(number) {
        return Math.round(number * 10) / 10;
    }

    static formatNumber(number) {
        return Number(number).toFixed().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }

    static setAttrs(element, attributes) {
        if (typeof attributes === 'object') {
            Object.keys(attributes).forEach((key) => {
                element.setAttribute(key, attributes[key]);
            });
        }
    }

    applyGradient(svg, path, colors, index) {
        const defs = (svg.querySelector('defs') === null)
            ? SVGFunnel.createSVGElement('defs', svg)
            : svg.querySelector('defs');
        const gradientName = `funnelGradient-${index}`;
        const gradient = SVGFunnel.createSVGElement('linearGradient', defs, {
            id: gradientName,
        });

        if (this.gradientDirection === 'vertical') {
            SVGFunnel.setAttrs(gradient, {
                x1: '0',
                x2: '0',
                y1: '0',
                y2: '1',
            });
        }

        const numberOfColors = colors.length;

        for (let i = 0; i < numberOfColors; i++) {
            SVGFunnel.createSVGElement('stop', gradient, {
                'stop-color': colors[i],
                offset: `${Math.round(100 * i / (numberOfColors - 1))}%`,
            });
        }
        //
        // SVGFunnel.setAttrs(path, {
        //     fill: `url("#${gradientName}")`,
        //     stroke: `url("#${gradientName}")`,
        // });
        SVGFunnel.setAttrs(path, {
            fill: 'none',
            stroke: `#${Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        });
    }

    makeSVG() {
        const svg = SVGFunnel.createSVGElement('svg', this.container, {
            width: this.getWidth(),
            height: this.getHeight(),
        });

        const valuesNum = this.getCrossAxisPoints().length;
        for (let i = 0; i < valuesNum; i++) {
            const path = SVGFunnel.createSVGElement('path', svg);

            if (this.fillMode === 'solid') {
                SVGFunnel.setAttrs(path, {
                    fill: this.color,
                    stroke: this.color,
                });
            } else if (this.fillMode === 'gradient') {
                const colors = this.color;
                this.applyGradient(svg, path, colors, i + 1);
            }

            svg.appendChild(path);
        }

        this.container.appendChild(svg);
    }

    getSVG() {
        const svg = this.container.querySelector('svg');

        if (!svg) {
            throw new Error('No SVG found inside of the container');
        }

        return svg;
    }

    getWidth() {
        return this.container.clientWidth;
    }

    getHeight() {
        return this.container.clientHeight;
    }

    /*

+----------->
^           |
|           |
<-----------v
     */

    static createLine(X, Y) {
        let str = 'M';

        for (let i = 0; i < X.length; i++) {
            str += ` ${X[i]},${Y[i]}`;
        }

        return str;
    }

    draw() {
        this.makeSVG();
        const svg = this.getSVG();

        this.addLabels();

        const paths = svg.querySelectorAll('path');
        const X = this.getMainAxisPoints();

        paths.forEach((path, index) => {
            const Y = this.getCrossAxisPoints()[index];
            // const d = this.direction === 'vertical'
            //     ? SVGFunnel.createVerticalPath(X, Y, width)
            //     : SVGFunnel.createPath(X, Y, height);
            const d = SVGFunnel.createLine(X, Y);
            path.setAttribute('d', d);
        });
    }
}

window.SVGFunnel = SVGFunnel;