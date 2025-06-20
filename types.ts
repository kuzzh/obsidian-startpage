export interface SVGTag {
	tagName: string;
	attributes: SVGTagAttribute;
}

export interface SVGTagAttribute {
	[key: string]: string | number | undefined;
}