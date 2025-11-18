
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
}