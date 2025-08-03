import {	Color, BufferGeometry, FileLoader, Float32BufferAttribute, GridHelper, Group, LineBasicMaterial, LineSegments, Mesh, PlaneGeometry } from "https://cdn.skypack.dev/three@0.136.0";

class Texfont {

	constructor(

		texobj,
		tex_width,
		tex_height,
		max_ascent,
		max_descent,
		num_glyphs,
		min_glyph,
		range,
		teximage,
		tgi,
		tgvi,
		lut,
		srcMaterial
					
					) {

		this.texobj = texobj;
		this.tex_width = 0;
		this.tex_height = 0;
		this.max_ascent = 0;
		this.max_descent = 0;
		this.num_glyphs = 0;
		this.min_glyph = 0;
		this.range = 0;
		this.teximage = [];
		this.tgi = new Array();
		this.tgvi = new Array();
		this.lut = new Array();
		this.srcMaterial = 0;

		
		//
		// public methods
		//

		this.LoadTexfont = function ( filename, txf ) {

			let data = 0;

			const loader = new FileLoader();
			loader.setResponseType( "arraybuffer" );

			//load a text file and output the result to the console
			loader.load(
				// resource URL
				filename,

				// onLoad callback (gets called when finished loading)
				function ( data ) {

					if ( !checkMagicNumber( data ) ) 	return;		// abort on fail
					swap = checkEndianness( data );			// do we need byte-swapping?
					readTexfontGlobals( txf, data );
					readGlyphMeta( txf, data );
					computeGlyphVertexInfo( txf );
					fetchTextureBitmap( txf, data );
				
					return txf;
	 
				},

				// onProgress callback
				function ( xhr ) {
	//				console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
				},

				// onError callback
				function ( err ) {
					console.error( 'An error happened' );
				}

			);

			return;

		};

		this.GetStringMetrics = function ( txf, string ) {
			/*
			 Dropped support for "fancy" strings, which relied on immediate mode OpenGL
			 and seemed of little relevance.
			 Added support for multi-line strings. Control sequence is CR-LF (0x0D, 0x0A)
			 */

			let w, i, tgvi, ch;
			let numLines;
			let maxWidth;
			
			let dimensions = {
				width: 0,				// report the greatest width of 1- or multi-line string
				height: 0,			// need this for multi-line strings
				max_ascent: 0,		// this is for correct vertical placement of 1-line string
				max_descent: 0		// this is for correct vertical placement of 1-line string
			};
			
			w = 0;
			numLines = 0;
			maxWidth = 0;
			
			for ( i = 0; i < string.length; i++ ) {

				tgvi = getTGVI(txf, string.charAt( i ) );
				w += tgvi.advance;
				maxWidth = Math.max( maxWidth, w );

			}
			
			dimensions.width = maxWidth;
			dimensions.height = ( numLines + 1) * ( txf.max_descent + txf.max_ascent );
			dimensions.max_ascent = txf.max_ascent;
			dimensions.max_descent = txf.max_descent;
			
			return dimensions;

		};

		this.ShowFontBitmap = function ( txf ) {

			/* show full Texfont.teximage bitmap, overlayed with grid of same resolution */

			let width = txf.tex_width;
			let height = txf.tex_height;

			let geometry = new PlaneGeometry( width, height );

			let mesh = new Mesh( geometry, txf.srcMaterial );

			// const srcGridHelper = new GridHelper( width, height, 0x404040, 0x404040 );
			// srcGridHelper.rotateX( Math.PI / 2.0 );
			// mesh.add( srcGridHelper );

			return mesh;

		};

		this.RenderString = function ( txf, text ) {
		/*
		 This renders the string "text"
		 */

			let texGroup = new Group();
				
			let dimensions = this.GetStringMetrics( txf, text );

			let xstart = - dimensions.width / 2;		// start a new line
			let ystart = - dimensions.max_ascent + dimensions.height / 2;
			let xpos = xstart;
			let ypos = ystart;
			let retVal;
			let maxWidth = 0;
			let numLines = 0;		// starts including zero; 0 means: 1 line of text;

			for ( let i = 0; i < text.length; i++ ) {

				retVal = RenderGlyph( txf, text.charAt( i ) );

				retVal.mesh.translateX( xpos );
				retVal.mesh.translateY( ypos );
				xpos += (retVal.advance+4.8); 

				texGroup.add( retVal.mesh );

			}

			//		Grid stuff - WARNING: not adopted for multi-line texts yet

			// let width = dimensions.width;
			// let height = dimensions.height;
			// let descent = dimensions.max_descent;
			// let ascent  = dimensions.max_ascent;
			// const GridHelper = new myGridHelper( width, height/2, height/2, 0x404040 );

			// GridHelper.translateZ( 0.01 );		// superimpose grid over textfont string
			// GridHelper.rotateX( Math.PI / 2.0 );

			// texGroup.add( GridHelper );

			return texGroup;

		};

		//
		// internals
		//

		let fp = 0;					// byte pos in file; file starts @ fp = 0;
		let format = 99;			// 0: bytemap; 1: bitmap
		let swap = false;			// false: Big Endian; true: Little Endian - needs byte swapping

		function checkMagicNumber( data ) {
		/*
		This function checks for the presence of the proper "magic" string
		at the start of the txf-file.
		The proper string is 4 characters long, in the following sequence:
		magic[0]: 0xff	-	decimal(255)
		magic[1]: 't'		-	decimal(116)
		magic[2]: 'x'		-	decimal(120)
		magic[3]: 'f'		-	decimal(102)

		NOTE, that this function implicitely advances the current
		byte-position "fp" by 4 bytes!

		*/
			console.log( "checking magic number ..." );

			var magic = data.slice( fp, fp+=4, "" );
			let Uint8View = new Uint8Array( magic );
			
			if (
				(                      Uint8View[ 0 ]   !== 255 ) ||
				( String.fromCharCode( Uint8View[ 1 ] ) !== 't' ) ||
				( String.fromCharCode( Uint8View[ 2 ] ) !== 'x' ) ||
				( String.fromCharCode( Uint8View[ 3 ] ) !== 'f' ) ) {

				console.log("%cYikes! This is not a txf-file ... aborting now", "background: yellow; color: red; font-weight: bold" );
				return false;

			}

			console.log( "%c... OK", "color: green; font-weight: bold" );

			return true;
			
		};

		function checkEndianness( data ) {
		/*
		The inventor of the txf file format apparently was a fan of hex editor use. So he inserted
		a human-readable 4-byte-sequence into the file header which can be used as an indicator
		of the endianness of the architecture:

		The byte sequence is as follows:
		[0] = 0x78		=> (dec) 120
		[1] = 0x56		=> (dec)  86
		[2] = 0x34		=> (dec)  52
		[3] = 0x12		=> (dec)  18

		Reading this byte sequence as a -32-bit integer reveals the machine's architecture:

		*/

		// check endianness
			console.log( "checking endianness ..." );

			let swap;

			var endianness = data.slice( fp, fp+=4, "" );
			let Uint32View = new Uint32Array( endianness );
			
			if ( Uint32View == 0x78563412 ) {
				swap = false;
				console.log( "%c... Big Endian", "color: green; font-weight: bold" );
			} else if ( Uint32View == 0x12345678 ) {
				swap = true;
				console.log( "%c... Little Endian", "color: green; font-weight: bold" );
			}
			
			return swap;

		};

		function readTexfontGlobals( txf, data ) {
		/*
		This reads the remaining 24 bytes of the 32-Byte header
		*/
			console.log( "Hello from readTexfontGlobals()" );

			format					= getUint32Val( data );
			txf.tex_width		= getUint32Val( data );
			txf.tex_height	= getUint32Val( data );
			txf.max_ascent	= getUint32Val( data );
			txf.max_descent	= getUint32Val( data );
			txf.num_glyphs	= getUint32Val( data );

			console.log( "%cLeaving readTexfontGlobals()", "color: green; font-weight: bold" );

		};

		function readGlyphMeta( txf, data ) {
		/*
			This function reads the metrics for each glyph and assembles them in a lookup table
		 */
			console.log( "Hello from readGlyphMeta()" );

			for ( let i = 0; i < txf.num_glyphs; i++ ) {
				
				var tgi = {						// TexGlyphInfo
					c:					' ',		// unsigned short: potentially support 16-bit glyphs
					width:			0,			// unsigned char
					height:			0,			// unsigned char
					xoffset:			0,			// signed char
					yoffset:			0,			// signed char
					advance:			0,			// signed char
					dummy: 			' ',		// char - place holder for alignment reasons
					x:					0,			// short (16-bit)
					y:					0			// short (16-bit)
				};
				
				tgi.c 		= getUint16Val( data );
				tgi.width	= getUint8Val( data );
				tgi.height	= getUint8Val( data );
				tgi.xoffset = getInt8Val( data );
				tgi.yoffset = getInt8Val( data );
				tgi.advance = getInt8Val( data );
				tgi.dummy	= getInt8Val( data );
				tgi.x			= getUint16Val( data );
				tgi.y			= getUint16Val( data );

				txf.tgi.push( tgi );
		//			console.log( tgi.c, String.fromCharCode(tgi.c), tgi.width, tgi.height, tgi.xoffset, tgi.yoffset, tgi.advance, tgi.dummy, tgi.x, tgi.y );
				
			}

			console.log( "%cLeaving readGlyphMeta()", "color: green; font-weight: bold" );

		};
			
		function computeGlyphVertexInfo( txf ) {
		/*
			This function computes dimensions and locations for each glyph rectangle,
			to be able to extract its particular sub-image from the texfont bitmap.
		 */
			console.log( "Hello from computeGlyphVertexInfo()" );

			let w = txf.tex_width;
			let h = txf.tex_height;
			let xstep = 0.5 / w;
			let ystep = 0.5 / h;

			for ( let i = 0; i < txf.num_glyphs; i++ ) {
				
				var tgi = txf.tgi[ i ];					// TexGlyphInfo
				
				var tgvi = {									// TexGlyphVertexInfo
					/*
					 These are the coordinates of the individual glyph rectangles, with:
					 "t" specifying texture coordinates (float) in the range [0.0 .. 1.0]
					 "v" specifying pixel coordinates (integer), from the lower left corner of the texture bitmap
					 "0" lower left
					 "1" lower right
					 "2" upper right
					 "3" upper left
					 */
					t0:	{
						x:	0.0,
						y:	0.0
					},
					v0:	{
						x: 0,
						y: 0
					},
					t1:	{
						x:	0.0,
						y:	0.0
					},
					v1:	{
						x: 0,
						y: 0
					},
					t2:	{
						x:	0.0,
						y:	0.0
					},
					v2:	{
						x: 0,
						y: 0
					},
					t3:	{
						x:	0.0,
						y:	0.0
					},
					v3:	{
						x: 0,
						y: 0
					},
					advance: 0
				};
				
				let l = tgi.x / w;						// left
				let r = (tgi.x + tgi.width) / w;	// right
				let t = (tgi.y + tgi.height) / h;	// top
				let b = tgi.y / h;						// bottom

				tgvi.t0.x = l;
				tgvi.t0.y = b;
				tgvi.v0.x = tgi.xoffset;
				tgvi.v0.y = tgi.yoffset;
				tgvi.t1.x = r;
				tgvi.t1.y = b;
				tgvi.v1.x = tgi.xoffset + tgi.width;
				tgvi.v1.y = tgi.yoffset;
				tgvi.t2.x = r;
				tgvi.t2.y = t;
				tgvi.v2.x = tgi.xoffset + tgi.width;
				tgvi.v2.y = tgi.yoffset + tgi.height;
				tgvi.t3.x = l;
				tgvi.t3.y = t;
				tgvi.v3.x = tgi.xoffset;
				tgvi.v3.y = tgi.yoffset + tgi.height;
				tgvi.advance = tgi.advance;

				txf.tgvi.push( tgvi );
				
			}		// end-for

			// find characters with lowest and highest ASCII-value
			
			let min_glyph = txf.tgi[0].c;
			let max_glyph = txf.tgi[0].c;
			
			for (let i = 1; i < txf.num_glyphs; i++) {
				if (txf.tgi[i].c < min_glyph) {
					min_glyph = txf.tgi[i].c;
			  }
				if (txf.tgi[i].c > max_glyph) {
					max_glyph = txf.tgi[i].c;
			  }
			}
			txf.min_glyph = min_glyph;
			txf.range = max_glyph - min_glyph + 1;		// [min ASCII .. max ASCII]

			// The range of supported glyphs in this Texfont may be non-contiguous, ASCII-wise
			// <==> 	Texfont.range >= Texfont.numGlyphs
			// Create a (potentially sparsely populated) lookup table of all glyphs in this Texfont,
			// without any leading or trailing "undefined" entries

			for (let i = 0; i < txf.num_glyphs; i++) {
				txf.lut[txf.tgi[i].c - txf.min_glyph] = txf.tgvi[i];
			}

			console.log( "%cLeaving computeGlyphVertexInfo()", "color: green; font-weight: bold" );

		};

		function fetchTextureBitmap( txf, data ) {
			/*
			 Retrieve the texture bitmap from the txf-file
			 */
			console.log( "Hello from fetchTextureBitmap()" );

			let width = txf.tex_width;			// width in [px]
			let height = txf.tex_height;		// height in [px]
			let size = 0;
			let byteView;
			let bitmap;

			switch ( format ) {
				case 0:			// TXF_FORMAT_BYTE	-	1 byte per pixel

					size = height * width;
					bitmap = data.slice( fp, fp+=size, "" );
					byteView = new Uint8Array( bitmap );
					
					for ( let i = 0; i < size; i++ ) {

						txf.teximage[ i ] = byteView [ i ];

					}
					
					break;			// never reached

				case 1:			// TXF_FORMAT_BITMAP		-	1 bit per pixel

					// copy bitmap into bytemap (one byte/pix); a set bit coressponds to byteval = 255,
					// an unset bit corresponds to a byteval = 0;
					// NOTE: bitorder per byte of original bitmap is reversed in the process:
					// 01234567 becomes 76543210

					let stride = ( width + 7 ) >> 3;		// stride in [byte], rounding up if necessary
					size = height * stride;
					bitmap = data.slice( fp, fp+=size, "" );
					byteView = new Uint8Array( bitmap );
		/*
		The "text" stuff was/is a visual debugging aid during development, uncomment to activate:

		Capture/copy the console output and paste it into Excel.
		Strip leading and trailing stuff that's not part of "text".
		Then apply a monospaced font, i.e. Courier, et voilà: view the bitmap, one cell per pixel!

		*/
		//				let text;
					
					for ( let i = 0; i < height; i++ ) {
		//					text = '';					// initialize new scanline
						for ( let j = 0; j < width; j++ ) {
							
							if ( byteView[ i * stride + ( j >> 3 ) ] & ( 1 << ( j & 7 ) ) ) {
								txf.teximage[ i * width + j ] = 255;
		//							text += '#';		// as dark as possible
							} else {
								txf.teximage[ i * width + j ] = 0;
		//							text += '-';		// as light as possible, while still visible
							}

						}
		//					console.log( text );		// log the full scanline
					}

					break;

				default:
				
					console.log("%cUnknown FORMAT currently not supported - aborting!", "background: yellow; color: red; font-weight: bold" );
					return false;

			}

			console.log( "%cLeaving fetchTextureBitmap()", "Color: green; font-weight: bold"  );

		};
		 
		function getTGVI( txf, ch ) {
		  /*
			GetTextGlyphVertexInfo
			
			Is character "ch" supported by this Texfont?
			If so, return its glyph's metrics.
			
			Automatically substitute uppercase letters with lowercase if not
			  uppercase available (and vice versa).
			*/

		  let cc = ch.charCodeAt(0);

		  if (( cc >= txf.min_glyph) && (cc < txf.min_glyph + txf.range)) {
				let tgvi = txf.lut[cc - txf.min_glyph];
			 if (tgvi) {       // success?
				return tgvi;
			 }
			 // no success. maybe substitution by opposite case can do
			 if (ch == ch.toLowerCase()) {
				  ch = ch.toUpperCase();
				  cc = ch.charCodeAt(0);
				  if ((cc >= txf.min_glyph) && (cc < txf.min_glyph + txf.range)) {
					  return txf.lut[cc - txf.min_glyph];
				}
			 }
			 if (ch == ch.toUpperCase()) {
				  ch = ch.toLowerCase();
				  cc = ch.charCodeAt(0);
				  if ((cc >= txf.min_glyph) && (cc < txf.min_glyph + txf.range)) {
					  return txf.lut[cc - txf.min_glyph];
				}
			 }
		  }
		  // no direct success, and not substitute success either
		  console.log("%ctexfont: tried to access unavailable font character: 0x" + cc.toString(16).toUpperCase().padStart(2, '0'), "background: yellow; color: red; font-weight: bold" );
		  return false;
		};

		function RenderGlyph( txf, ch ) {
			/*
			 renders one character
			 */
			 
			let retVal = {
				mesh:		0,
				advance:	0
			};
			let geometry, geometries;
			let glyphMesh;

			let tgvi = getTGVI( txf, ch );

			let width = tgvi.v1.x - tgvi.v0.x;
			let height = tgvi.v2.y - tgvi.v1.y;

			geometry = new PlaneGeometry( width, height );

			geometry.attributes.position.array[ 0 ] = tgvi.v3.x;	// upper left
			geometry.attributes.position.array[ 1 ] = tgvi.v3.y;
			geometry.attributes.position.array[ 2 ] = 0.0;

			geometry.attributes.position.array[ 3 ] = tgvi.v2.x;	// upper right
			geometry.attributes.position.array[ 4 ] = tgvi.v2.y;
			geometry.attributes.position.array[ 5 ] = 0.0;

			geometry.attributes.position.array[ 6 ] = tgvi.v0.x;	// lower left
			geometry.attributes.position.array[ 7 ] = tgvi.v0.y;
			geometry.attributes.position.array[ 8 ] = 0.0;

			geometry.attributes.position.array[  9 ] = tgvi.v1.x;	// lower right
			geometry.attributes.position.array[ 10 ] = tgvi.v1.y;
			geometry.attributes.position.array[ 11 ] = 0.0;

			geometry.attributes.uv.array[ 0 ] = tgvi.t3.x;	// upper left
			geometry.attributes.uv.array[ 1 ] = tgvi.t3.y;

			geometry.attributes.uv.array[ 2 ] = tgvi.t2.x;	// upper right
			geometry.attributes.uv.array[ 3 ] = tgvi.t2.y;

			geometry.attributes.uv.array[ 4 ] = tgvi.t0.x;	// lower left
			geometry.attributes.uv.array[ 5 ] = tgvi.t0.y;

			geometry.attributes.uv.array[ 6 ] = tgvi.t1.x;	// lower right
			geometry.attributes.uv.array[ 7 ] = tgvi.t1.y;


			glyphMesh = new Mesh( geometry, txf.srcMaterial );

			retVal.mesh = glyphMesh;
			retVal.advance = tgvi.advance;

			return retVal;
			 
		};

		function getUint32Val( data ) {
		/*
		Reads four unsigned bytes from Blob "data" and returns the corresponding 32-bit value,
		observing byte swapping if necessary.
		The current file position "fp" gets advanced by four bytes in the process.
		*/

			var buf = data.slice( fp, fp+=4, "" );
			let view = new Uint8Array( buf );

			if (swap ) {

				return ( view[3]<<24 ) + ( view[2]<<16 ) + ( view[1]<<8 ) + ( view[0] );
			 
			} else {
			 
				return ( view[0]<<24 ) + ( view[1]<<16 ) + ( view[2]<<8 ) + ( view[3] );

			}

		};

		function getUint16Val( data ) {
		/*
		Reads two unsigned bytes from Blob "data" and returns the corresponding 16-bit value,
		observing byte swapping if necessary.
		The current file position "fp" gets advanced by two bytes in the process.
		*/

			var buf = data.slice( fp, fp+=2, "" );
			let view = new Uint8Array( buf );

			if (swap ) {

				return (view[1]<<8) + ( view[0] );
			 
			} else {
			 
				return (view[0]<<8) + ( view[1] );

			}

		};

		function getUint8Val( data ) {
		/*
		Reads one unsigned byte from Blob "data" and returns the corresponding 8-bit value.
		The current file position "fp" gets advanced by one byte in the process.
		*/

			var buf = data.slice( fp, fp+=1, "" );
			let view = new Uint8Array( buf );

			return view[0];

		};

		function getInt8Val( data ) {
		/*
		Reads one signed byte from Blob "data" and returns the corresponding 8-bit value.
		The current file position "fp" gets advanced by one byte in the process.
		*/

			var buf = data.slice( fp, fp+=1, "" );
			let view = new Int8Array( buf );

			return view[0];

		};

	};

}
									 
class myGridHelper extends LineSegments {
	 /*
	  This is a modified version of the THREE.Gridhelper for use with Texfont only.
	  One color only, but allows for width and height specification. Height is split into
	  "descent" and "ascent", to allow for asymmetrical vertical placement of the grid.
	  Vertical divisions = height, horizontal divisions = width, i.e. square cells.
	  */

	 constructor( width = 10, descent = 10, ascent = 20, color = 0x444444 ) {

		 color = new Color( color );

		 const step = 1;
		 const halfWidth = width / 2;
		 const halfHeight = ( descent + ascent ) / 2;

		 const vertices = [], colors = [];
		 let j = 0;

		 for ( let i = -descent, k = descent; i <= ascent; i ++, k -= step ) {

			 vertices.push( - halfWidth, 0, k, halfWidth, 0, k );

			 color.toArray( colors, j ); j += 3;
			 color.toArray( colors, j ); j += 3;

		 }

		 for ( let i = 0, k = halfWidth; i <= width; i ++, k -= step ) {

			 vertices.push( k, 0, descent, k, 0, - ascent );

			 color.toArray( colors, j ); j += 3;
			 color.toArray( colors, j ); j += 3;

		 }

		 const geometry = new BufferGeometry();
		 geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
		 geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

		 const material = new LineBasicMaterial( { vertexColors: true, toneMapped: false } );

		 super( geometry, material );

		 this.type = 'myGridHelper';

	 }

 }

export { Texfont };
