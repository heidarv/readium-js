// Description: This model contains the implementation for "instructions" included in the EPUB CFI domain specific language (DSL). 
//   Lexing and parsing a CFI produces a set of executable instructions for processing a CFI (represented in the AST). 
//   This object contains a set of functions that implement each of the executable instructions in the AST. 

EPUBcfi.CFIInstructions = {

	// ------------------------------------------------------------------------------------ //
	//  "PUBLIC" METHODS (THE API)                                                          //
	// ------------------------------------------------------------------------------------ //

	// Description: Follows a step
	// Rationale: The use of children() is important here, as this jQuery method returns a tree of xml nodes, EXCLUDING
	//   CDATA and text nodes. When we index into the set of child elements, we are assuming that text nodes have been 
	//   excluded.
	// REFACTORING CANDIDATE: This should be called "followIndexStep"
	getNextNode : function (CFIStepValue, $currNode) {

		// Find the jquery index for the current node
		var $targetNode;
		if (CFIStepValue % 2 == 0) {

			$targetNode = this.elementNodeStep(CFIStepValue, $currNode);
		}
		else {

			$targetNode = this.inferTargetTextNode(CFIStepValue, $currNode);
		}

		return $targetNode;
	},

	// Description: This instruction executes an indirection step, where a resource is retrieved using a 
	//   link contained on a attribute of the target element. The attribute that contains the link differs
	//   depending on the target. 
	// REFACTORING CANDIDATE: At the moment, an itemref indirection step is not followed using this method and it 
	//   may never be the case that this occurs (it is not currently expected to be called). 
	//   However, this method will need to support the other types of indirection steps in the future.
	followIndirectionStep : function (CFIStepValue, $currNode, $packageDocument) {

		var that = this;
		var indexOfFilenameStart;
		var URLForRetrieve;
		var jqueryTargetNodeIndex = (CFIStepValue / 2) - 1;
		var $targetNode;
		var contentDocHref;
		var contentDoc;

		// TODO: This check must be expanded to all the different types of indirection step
		// This is an item ref
		if ($currNode === undefined || !$currNode.is("itemref")) {

			throw EPUBcfi.NodeTypeError($currNode, "expected an itemref element");
		}

		// Load the content document referenced by the spine item
		// Remove the package document filename from the package document url
		indexOfFilenameStart = EPUBcfi.Config.packageDocumentURL.lastIndexOf('/') + 1;
		URLForRetrieve = EPUBcfi.Config.packageDocumentURL.substr(0, indexOfFilenameStart);

		// The URLForRetrieve parameter might need to be passed in? Not sure at the moment.
		contentDocHref = 
			 URLForRetrieve +
			$("#" + $currNode.attr("idref"), $packageDocument).attr("href");
		contentDoc = EPUBcfi.Config.retrieveResource(contentDocHref);

		if (that.indexOutOfRange(jqueryTargetNodeIndex, $(contentDoc.firstChild).children().not('.cfiMarker').length)) {

			throw EPUBcfi.OutOfRangeError(jqueryTargetNodeIndex, $(contentDoc.firstChild).children().not('.cfiMarker').length, "");
		}

		// contentDoc.firstChild is intended to return the html element
		$targetNode = $($(contentDoc.firstChild).children().not('.cfiMarker')[jqueryTargetNodeIndex]);

		// TODO: check for validity of returned node
		return $targetNode;
		
		// TODO: Other types of indirection
		// TODO: ($targetNode.is("iframe") || $targetNode.is("embed")) : src
		// TODO: ($targetNode.is("object")) : data
		// TODO: ($targetNode.is("image") || $targetNode.is("xlink:href")) : xlink:href
	},

	// Description: Injects an element at the specified text node
	// Arguments: a cfi text termination string, a jquery object to the current node
	textTermination : function ($currNode, textOffset, elementToInject) {

		var targetTextNode; 
		var originalText;
		var textWithInjection;

		// Get the first node, this should be a text node
		if ($currNode === undefined) {

			throw EPUBcfi.NodeTypeError($currNode, "expected a terminating node, or node list");
		} 
		else if ($currNode.length === 0) {

			throw EPUBcfi.TerminusError("Text", "Text offset:" + textOffset, "no nodes found for termination condition");
		}

		$currNode = this.injectCFIMarkerIntoText($currNode, textOffset, elementToInject);
		return $currNode;
	},

	// Description: Checks that the id assertion for the node target matches that on 
	//   the found node. 
	targetIdMatchesIdAssertion : function ($foundNode, idAssertion) {

		if ($foundNode.attr("id") === idAssertion) {

			return true;
		}
		else {

			return false;
		}
	},

	// Description: Generates a character offset CFI 
	// Arguments: The text node that contains the offset referenced by the cfi, the offset value, the name of the 
	//   content document that contains the text node, the package document for this EPUB.
	generateCharacterOffsetCFI : function (startTextNode, characterOffset, contentDocumentName, packageDocument) {

		var CFI;

		// call the recursive function to get all the steps until the top of the content document
		CFI = this.createCFISteps($(startTextNode)) + CFI;

		// Get the start node (itemref element) that references the content document

		// Get the steps to the top of the package document

		// Return the CFI with "epubcfi()" appended. Could use the parser to check its validity. 

	},

	// ------------------------------------------------------------------------------------ //
	//  "PRIVATE" HELPERS                                                                   //
	// ------------------------------------------------------------------------------------ //

	// REFACTORING CANDIDATE: Some of the parts of this method could be refactored into their own methods. 
	createCFITextNodeStep : function ($startTextNode, characterOffset) {

		var $parentNode;
		var $contentsExcludingMarkers;
		var currIndex;
		var CFIIndex;
		var indexOfTextNode;
		var preAssertion;
		var preAssertionStartIndex;
		var textLength;
		var postAssertion;
		var postAssertionEndIndex;

		// Find text node position in the set of child elements, ignoring any cfi markers 
		$parentNode = $startTextNode.parent();

		// REFACTORING CANDIDATE: This code exists in the inferTargetNode method and should be moved into its own method
		$contentsExcludingMarkers = $parentNode.contents().filter(
			function () {

				if ($(this).filter(".cfiMarker").length !== 0) {
					return false;
				}
				else {
					return true;
				}
			}
		);

		// Find the text node number in the list, inferring nodes that were originally together
		currIndex = 0;
		$.each($contentsExcludingMarkers, 
			function () {

				// If this is a text node, check if it matches and return the current index
				if (this.nodeType === 3) {

					if (this === $startTextNode[0]) {

						indexOfTextNode = currIndex;
						return false; // Break out of .each loop
					}
				}
				// Increment the index if a non-tex element is hit
				else {

					currIndex++;
				}
			}
		);

		// Convert the text node number to a CFI odd-integer representation
		CFIIndex = (indexOfTextNode * 2) + 1;

		// Add pre- and post- text assertions
		preAssertionStartIndex = (characterOffset - 3 >= 0) ? characterOffset - 3 : 0;
		preAssertion = $startTextNode[0].nodeValue.substring(preAssertionStartIndex, characterOffset);

		textLength = $startTextNode[0].nodeValue.length;
		postAssertionEndIndex = (characterOffset + 3 <= textLength) ? characterOffset + 3 : textLength;
		postAssertion = $startTextNode[0].nodeValue.substring(characterOffset, postAssertionEndIndex);

		// return the constructed text node step
		return "/" + CFIIndex + ":" + characterOffset + "[" + preAssertion + "," + postAssertion + "]";
	},

	createCFIElementSteps : function ($currNode, characterOffset) {

		var textNodeStep;
		var $parentNode;
		var currNodePosition;
		var CFIPosition;
		var idAssertion;
		var elementStep; 

		if ($currNode[0].nodeType === 3) {

			textNodeStep = this.createCFITextNodeStep($currNode, characterOffset);
			return this.createCFIElementSteps($currNode.parent()) + textNodeStep; 
		}

		// Find position of current node in parent list. The use of .index() assumes that only 
		// xml element nodes are considered (not CDATA, text etc.)
		currNodePosition = $currNode.index();

		// Convert position to the CFI even-integer representation
		CFIPosition = (currNodePosition + 1) * 2;

		// Create CFI step with id assertion, if the element has an id
		if ($currNode.attr("id")) {

			elementStep = "/" + CFIPosition + "[" + $currNode.attr("id") + "]";
		}
		else {

			elementStep = "/" + CFIPosition;
		}

		// If a parent is an html element return the (last) step for this content document, otherwise, continue
		$parentNode = $currNode.parent();
		if ($parentNode.is("html")) {
			
			return elementStep;
		}
		else {

			return this.createCFIElementSteps($parentNode) + elementStep;
		}
	},

	// Description: Step reference for xml element node. Expected that CFIStepValue is an even integer
	elementNodeStep : function (CFIStepValue, $currNode) {

		var $targetNode;
		var jqueryTargetNodeIndex = (CFIStepValue / 2) - 1;
		if (this.indexOutOfRange(jqueryTargetNodeIndex, $currNode.children().not('.cfiMarker').length)) {

			throw EPUBcfi.OutOfRangeError(jqueryTargetNodeIndex, $currNode.children().not('.cfiMarker').length, "");
		}

	    $targetNode = $($currNode.children().not('.cfiMarker')[jqueryTargetNodeIndex]);
		return $targetNode;
	},

	retrieveItemRefHref : function ($itemRefElement, $packageDocument) {

		return $("#" + $itemRefElement.attr("idref"), $packageDocument).attr("href");
	},

	indexOutOfRange : function (targetIndex, numChildElements) {

		return (targetIndex > numChildElements - 1) ? true : false;
	},

	// Rationale: In order to inject an element into a specific position, access to the parent object 
	//   is required. This is obtained with the jquery parent() method. An alternative would be to 
	//   pass in the parent with a filtered list containing only children that are part of the target text node.
	injectCFIMarkerIntoText : function ($textNodeList, textOffset, elementToInject) {

		var nodeNum;
		var currNodeLength;
		var currTextPosition = 0;
		var nodeOffset;
		var originalText;
		var $injectedNode;
		var $newTextNode;
		// The iteration counter may be incorrect here (should be $textNodeList.length - 1 ??)
		for (nodeNum = 0; nodeNum <= $textNodeList.length; nodeNum++) {

			if ($textNodeList[nodeNum].nodeType === 3) {

				currNodeMaxIndex = ($textNodeList[nodeNum].nodeValue.length - 1) + currTextPosition;
				nodeOffset = textOffset - currTextPosition;

				if (currNodeMaxIndex >= textOffset) {

					// This node is going to be split and the components re-inserted
					originalText = $textNodeList[nodeNum].nodeValue;	

					// Before part
				 	$textNodeList[nodeNum].nodeValue = originalText.slice(0, nodeOffset);

					// Injected element
					$injectedNode = $(elementToInject).insertAfter($textNodeList.eq(nodeNum));

					// After part
					$newTextNode = $(document.createTextNode(originalText.slice(nodeOffset, originalText.length)));
					$($newTextNode).insertAfter($injectedNode);

					return $textNodeList.parent();
				}
				else {

					currTextPosition = currTextPosition + currNodeMaxIndex;
				}
			}
		}

		throw EPUBcfi.TerminusError("Text", "Text offset:" + textOffset, "The offset exceeded the length of the text");
	},

	// Description: This method finds a target text node and then injects an element into the appropriate node
	// Arguments: A step value that is an odd integer. A current node with a set of child elements.
	// Rationale: The possibility that cfi marker elements have been injected into a text node at some point previous to 
	//   this method being called (and thus splitting the original text node into two separate text nodes) necessitates that
	//   the set of nodes that compromised the original target text node are inferred and returned.
	// Notes: Passed a current node. This node should have a set of elements under it. This will include at least one text node, 
	//   element nodes (maybe), or possibly a mix. 
	// REFACTORING CANDIDATE: This method is pretty long. Worth investigating to see if it can be refactored into something clearer.
	inferTargetTextNode : function (CFIStepValue, $currNode) {
		
		var $elementsWithoutMarkers;
		var currTextNodePosition;
		var logicalTargetPosition;
		var nodeNum;
		var $targetTextNodeList;

		// Remove any cfi marker elements from the set of elements. 
		// Rationale: A filtering function is used, as simply using a class selector with jquery appears to 
		//   result in behaviour where text nodes are also filtered out, along with the class element being filtered.
		$elementsWithoutMarkers = $currNode.contents().filter(
			function () {

				if ($(this).filter(".cfiMarker").length !== 0) {
					return false;
				}
				else {
					return true;
				}
			}
		);

		// Convert CFIStepValue to logical index; assumes odd integer for the step value
		logicalTargetPosition = (parseInt(CFIStepValue) + 1) / 2;

		// Set text node position counter
		currTextNodePosition = 1;
		$targetTextNodeList = $elementsWithoutMarkers.filter(
			function () {

				if (currTextNodePosition === logicalTargetPosition) {

					// If it's a text node
					if (this.nodeType === 3) {
						return true; 
					}
					// Any other type of node, move onto the next text node
					else {
						currTextNodePosition++; 
						return false;
					}
				}
				// In this case, don't return any elements
				else {

					// If its the last child and it's not a text node, there are no text nodes after it
					// and the currTextNodePosition shouldn't be incremented
					if (this.nodeType !== 3 && this !== $elementsWithoutMarkers.lastChild) {
						currTextNodePosition++;
					}

					return false;
				}
			}
		);

		// The filtering above should have counted the number of "logical" text nodes; this can be used to 
		// detect out of range errors
		if ($targetTextNodeList.length === 0) {

			throw EPUBcfi.OutOfRangeError(logicalTargetPosition, currTextNodePosition, "Index out of range");
		}

		// return the text node list
		return $targetTextNodeList;
	}
};


