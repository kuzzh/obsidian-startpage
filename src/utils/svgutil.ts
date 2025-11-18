import { SVGTag, ID_STAT_TOTAL_NOTES, ID_STAT_TODAY_EDITED, ID_STAT_TOTAL_SIZE } from "../types";

export default class SvgUtil {
    static createFolderIcon(): SVGElement {
        const svgNs = "http://www.w3.org/2000/svg";
        const folderSvg = document.createElementNS(svgNs, "svg");
        folderSvg.setAttribute("viewBox", "0 0 24 24");
        folderSvg.setAttribute("width", "14");
        folderSvg.setAttribute("height", "14");
        const pathNode = document.createElementNS(svgNs, "path");
        pathNode.setAttribute("d", "M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z");
        pathNode.setAttribute("fill", "currentColor");
        folderSvg.appendChild(pathNode);
        return folderSvg;
    }

    static createArrowUpIcon(): SVGElement {
        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        const path = document.createElementNS(svgNs, "path");
        path.setAttribute("d", "M12 8l-6 6h12l-6-6z");
        path.setAttribute("fill", "currentColor");
        svg.appendChild(path);
        return svg;
    }

    static createArrowDownIcon(): SVGElement {
        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        const path = document.createElementNS(svgNs, "path");
        path.setAttribute("d", "M12 16l6-6H6l6 6z");
        path.setAttribute("fill", "currentColor");
        svg.appendChild(path);
        return svg;
    }

    static createRemoveIcon(): SVGElement {
        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        const pathNode = document.createElementNS(svgNs, "path");
        pathNode.setAttribute("d", "M6 7h12v2H6V7zm2 2h8l-1 9H9l-1-9zm2-4h4l1 2H9l1-2z");
        pathNode.setAttribute("fill", "currentColor");
        svg.appendChild(pathNode);
        return svg;
    }

    static createFileIcon(fileType: string): SVGSVGElement {
        return SvgUtil.createSVG((this.iconSVGs as Record<string, SVGTag[]>)[fileType] || this.iconSVGs["md"]);
    }

    static createEditIcon(): SVGSVGElement {
        return this.createSVG([
            { tagName: "path", attributes: { d: "M11 4H4A2 2 0 0 0 2 6V20A2 2 0 0 0 4 22H18A2 2 0 0 0 20 20V13" } },
            { tagName: "path", attributes: { d: "M18.5 2.5L22 6L12 16H6V10L18.5 2.5Z" } },
        ]);
    }

    static createRefreshIcon(): SVGSVGElement {
        return this.createSVG([
            { tagName: "path", attributes: { d: "M3 2v6h6" } },
            { tagName: "path", attributes: { d: "M3 13a9 9 0 1 0 3-7.7L3 8" } },
        ], "refresh-icon");
    }

    static createLogoIcon(): SVGSVGElement {
        return this.createSVG(
            [
                { tagName: "path", attributes: { d: "M12 2L2 7L12 12L22 7L12 2Z", "stroke-linecap": "none" } },
                { tagName: "path", attributes: { d: "M2 17L12 22L22 17", "stroke-linecap": "none" } },
                { tagName: "path", attributes: { d: "M2 12L12 17L22 12", "stroke-linecap": "none" } },
            ],
            "logo-icon"
        );
    }

    static createNewNoteIcon(): SVGSVGElement {
        return this.createSVG(
            [
                { tagName: "path", attributes: { d: "M12 5V19" } },
                { tagName: "path", attributes: { d: "M5 12H19" } },
            ],
            "new-note-icon"
        );
    }

    static createPinnedNoteIcon(): SVGSVGElement {
        return this.createSVG([
            {
                tagName: "path",
                attributes: {
                    d: "M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z",
                    fill: "currentColor",
                },
            },
        ], "section-icon");
    }

    static createRecentNoteIcon(): SVGSVGElement {
        return this.createSVG([
            {
                tagName: "path",
                attributes: {
                    d: "M12 8V12L15 15",
                },
            },
            {
                tagName: "circle",
                attributes: {
                    cx: 12,
                    cy: 12,
                    r: 10,
                    stroke: "currentColor",
                    "stroke-width": 2,
                },
            },
        ], "section-icon");
    }

    static createStatIcon(id: string): SVGSVGElement | null {
        if (id === ID_STAT_TOTAL_NOTES) {
            return this.createSVG([
                { tagName: "path", attributes: { d: "M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" } },
                { tagName: "path", attributes: { d: "M14 2V8H20" } },
            ]);
        } else if (id === ID_STAT_TODAY_EDITED) {
            return this.createSVG([
                { tagName: "path", attributes: { d: "M12 8V12L15 15" } },
                { tagName: "circle", attributes: { cx: 12, cy: 12, r: 10, stroke: "currentColor", "stroke-width": 2 } },
            ]);
        } else if (id === ID_STAT_TOTAL_SIZE) {
            return this.createSVG([
                {
                    tagName: "rect",
                    attributes: {
                        x: "3",
                        y: "6",
                        width: "18",
                        height: "12",
                        rx: "2",
                        ry: "2",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        fill: "none",
                    },
                },
                {
                    tagName: "circle",
                    attributes: {
                        cx: "7",
                        cy: "12",
                        r: "1",
                        fill: "currentColor",
                    },
                },
                {
                    tagName: "path",
                    attributes: {
                        d: "M11 10H17",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        "stroke-linecap": "round",
                    },
                },
                {
                    tagName: "path",
                    attributes: {
                        d: "M11 14H15",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        "stroke-linecap": "round",
                    },
                },
            ]);
        }
        return null;
    }

    static createSVG(tags: SVGTag[], className: string | null = null): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (className) svg.setAttribute("class", className);

        tags.forEach((tag) => {
            const element = document.createElementNS("http://www.w3.org/2000/svg", tag.tagName);

            if (tag.tagName === "path" && !tag.attributes.fill) {
                tag.attributes.stroke = tag.attributes.stroke || "currentColor";
                tag.attributes["stroke-width"] = tag.attributes["stroke-width"] || "2";
                tag.attributes["stroke-linecap"] = tag.attributes["stroke-linecap"] || "round";
                tag.attributes["stroke-linejoin"] = tag.attributes["stroke-linejoin"] || "round";
            }

            for (let [key, value] of Object.entries(tag.attributes)) {
                if (value === undefined) continue;
                if (typeof value === "number") value = value.toString();

                element.setAttribute(key, value);
            }

            svg.appendChild(element);
        });

        return svg;
    }

    static iconSVGs = {
        "md": [
            { tagName: "path", attributes: { d: "M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" } },
            { tagName: "path", attributes: { d: "M14 2V8H20" } },
        ],
        "base": [
            { tagName: "rect", attributes: { x: "4", y: "3", width: "16", height: "20", rx: "2", stroke: "currentColor", "stroke-width": "2", fill: "none" } },
            { tagName: "path", attributes: { d: "M6 10H18", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } },
            { tagName: "path", attributes: { d: "M6 16H18", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } },
            { tagName: "path", attributes: { d: "M10 4V24", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } }
        ],
        "canvas": [
            { tagName: "rect", attributes: { x: "4", y: "3", width: "16", height: "20", rx: "2", stroke: "currentColor", "stroke-width": "2", fill: "none" } },
            // Three bold nodes, spread out inside the rect
            { tagName: "circle", attributes: { cx: "8", cy: "9", r: "2", fill: "currentColor" } },
            { tagName: "circle", attributes: { cx: "16", cy: "9", r: "2", fill: "currentColor" } },
            { tagName: "circle", attributes: { cx: "12", cy: "17", r: "2", fill: "currentColor" } },
            // Connecting lines
            { tagName: "path", attributes: { d: "M10 9L14 9", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } },
            { tagName: "path", attributes: { d: "M9.4 10.6L12 15", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } },
            { tagName: "path", attributes: { d: "M14.6 10.6L12 15", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" } }
        ],
    }
}