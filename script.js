document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const arrayInput = document.getElementById('array-input');
    const pivotStrategySelect = document.getElementById('pivot-strategy');
    const startSortButton = document.getElementById('start-sort');
    const nextStepButton = document.getElementById('next-step');
    const autoPlayButton = document.getElementById('auto-play');
    const resetButton = document.getElementById('reset');

    const arrayContainer = document.getElementById('array-container');
    const statusMessage = document.getElementById('status-message');

    const recursionTreeContainer = document.getElementById('recursion-tree-container');
    const recursionDepthSpan = document.getElementById('recursion-depth');
    const functionCallsSpan = document.getElementById('function-calls');
    const currentPivotImpactP = document.getElementById('current-pivot-impact');
    const observedPerformanceTendencyP = document.getElementById('observed-performance-tendency'); // NEW

    // Quiz Elements
    const quizQuestionDiv = document.getElementById('quiz-question');
    const quizOptionsDiv = document.getElementById('quiz-options');
    const submitAnswerButton = document.getElementById('submit-answer');
    const quizFeedbackDiv = document.getElementById('quiz-feedback');

    // State Variables
    let initialUnsortedArray = []; // To store the array as it was before sorting for analysis
    let originalArray = [];
    let workingArray = [];
    let animationSteps = [];
    let currentStepIndex = 0;
    let autoPlayInterval = null;
    let autoPlaySpeed = 800; // ms

    let functionCalls = 0;
    let maxRecursionDepth = 0;
    let currentRecursionTreeRoot = null;

    // --- Helper Functions ---

    function displayArray(arrToDisplay = workingArray, highlights = {}) {
        arrayContainer.innerHTML = '';
        if (!arrToDisplay) {
            return;
        }
        if (arrToDisplay.length === 0) {
            arrayContainer.innerHTML = '<div>(Array is empty)</div>';
            return;
        }

        const valuesOnly = arrToDisplay.map(item => (typeof item === 'object' ? item.value : item));
        if (valuesOnly.some(val => typeof val !== 'number' || isNaN(val))) {
            console.error("displayArray: Array contains non-numeric or NaN values:", arrToDisplay);
            arrayContainer.innerHTML = '<div>Error: Array contains invalid data.</div>';
            return;
        }

        let visualScalingMax = 1;
        if (valuesOnly.length > 0) {
            const maxInArray = Math.max(...valuesOnly);
            if (maxInArray > 0) {
                visualScalingMax = maxInArray;
            }
        }


        arrToDisplay.forEach((item, index) => {
            const value = (typeof item === 'object' ? item.value : item);
            const elementDiv = document.createElement('div');
            elementDiv.classList.add('array-element');
            elementDiv.textContent = value;

            let barHeightRatio = 0;
            if (value > 0 && visualScalingMax > 0) {
                barHeightRatio = value / visualScalingMax;
            }

            const minElementHeight = 20;
            const scalableHeightRange = 80;

            elementDiv.style.height = `${minElementHeight + (barHeightRatio * scalableHeightRange)}px`;

            if (highlights.pivot === index) elementDiv.classList.add('pivot');
            if (highlights.comparing && highlights.comparing.includes(index)) elementDiv.classList.add('comparing');
            if (highlights.swapping && highlights.swapping.includes(index)) elementDiv.classList.add('swapping');
            if (highlights.subArray && typeof highlights.subArray.low === 'number' && typeof highlights.subArray.high === 'number' &&
                index >= highlights.subArray.low && index <= highlights.subArray.high) {
                elementDiv.classList.add('sub-array');
            }
            if (highlights.sortedPartition && highlights.sortedPartition.includes(index)) {
                elementDiv.classList.add('sorted-partition');
            }
            arrayContainer.appendChild(elementDiv);
        });
    }

    function updateStatus(message) {
        statusMessage.textContent = `Status: ${message}`;
    }

    function resetVisualization() {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
        initialUnsortedArray = []; // NEW
        originalArray = [];
        workingArray = [];
        animationSteps = [];
        currentStepIndex = 0;
        functionCalls = 0;
        maxRecursionDepth = 0;
        currentRecursionTreeRoot = null;

        arrayInput.value = '';
        arrayContainer.innerHTML = '';
        recursionTreeContainer.innerHTML = '';
        updateStatus('Waiting for input...');
        recursionDepthSpan.textContent = '0';
        functionCallsSpan.textContent = '0';
        observedPerformanceTendencyP.textContent = ''; // NEW: Clear observed performance
        startSortButton.disabled = false;
        nextStepButton.disabled = true;
        autoPlayButton.disabled = true;
        autoPlayButton.textContent = 'Auto Play';
        currentPivotImpactP.textContent = 'Select a pivot strategy to see its potential impact.';
        resetQuiz();
    }

    // --- Event Listeners ---
    startSortButton.addEventListener('click', () => {
        const inputText = arrayInput.value.trim();
        if (!inputText) {
            alert('Please enter an array of numbers.');
            return;
        }
        // Parse for initialUnsortedArray and originalArray BEFORE resetVisualization clears them
        const parsedArray = inputText.split(',')
            .map(numStr => parseInt(numStr.trim(), 10))
            .filter(num => !isNaN(num));

        if (parsedArray.length === 0) {
            alert('Invalid input or no numbers entered. Please enter comma-separated numbers.');
            return;
        }

        resetVisualization(); // Resets all state variables

        // Now assign the parsed array to the state variables
        initialUnsortedArray = parsedArray.slice(); // Store the true original for analysis
        originalArray = parsedArray.slice();
        workingArray = originalArray.slice();


        updateStatus('Initializing Quick Sort...');
        prepareQuickSort();

        startSortButton.disabled = true;
        if (animationSteps.length > 0) {
            nextStepButton.disabled = false;
            autoPlayButton.disabled = false;
        } else {
            nextStepButton.disabled = true;
            autoPlayButton.disabled = true;
        }

        displayArray(workingArray);
    });

    nextStepButton.addEventListener('click', () => {
        executeNextStep();
    });

    autoPlayButton.addEventListener('click', () => {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            autoPlayButton.textContent = 'Auto Play';
            if (currentStepIndex < animationSteps.length) {
                updateStatus('Auto play paused.');
            }
        } else {
            autoPlayButton.textContent = 'Pause';
            updateStatus('Auto playing...');
            executeNextStep();
            if (currentStepIndex < animationSteps.length) {
                autoPlayInterval = setInterval(executeNextStep, autoPlaySpeed);
            } else {
                autoPlayButton.textContent = 'Auto Play';
            }
        }
    });

    resetButton.addEventListener('click', resetVisualization);

    pivotStrategySelect.addEventListener('change', () => {
        const strategy = pivotStrategySelect.value;
        if (strategy === "medianOfThree") {
            currentPivotImpactP.textContent = "Median-of-Three: Good for avoiding worst-case on sorted/nearly sorted data. Adds slight overhead.";
        } else if (strategy === "random") {
            currentPivotImpactP.textContent = "Random Pivot: Generally good performance, makes worst-case unlikely but still possible.";
        } else if (strategy === "first" || strategy === "last") {
            currentPivotImpactP.textContent = `Using ${strategy} element: Simple, but prone to O(n^2) on sorted or reverse-sorted arrays.`;
        } else if (strategy === "middle") {
            currentPivotImpactP.textContent = "Middle Element: Better than first/last for sorted data, but can still hit worst-cases.";
        }
    });


    // --- Quick Sort Core Logic (modified for visualization) ---

    // NEW: Helper to check if an array is sorted
    function isArraySorted(arr) {
        if (arr.length < 2) return true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] > arr[i + 1]) return false;
        }
        return true;
    }

    // NEW: Helper to check if an array is reverse sorted
    function isArrayReverseSorted(arr) {
        if (arr.length < 2) return true;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] < arr[i + 1]) return false;
        }
        return true;
    }

    // NEW: Analyze performance and display tendency
    function analyzeAndDisplayPerformanceTendency() {
        const n = initialUnsortedArray.length;
        if (n === 0) {
            observedPerformanceTendencyP.textContent = '';
            return;
        }

        let tendencyMessage = "Average Case O(n log n)"; // Default
        const currentPivotStrategy = pivotStrategySelect.value;

        // Check for known worst-case triggers
        if ((currentPivotStrategy === 'first' || currentPivotStrategy === 'last') && n > 2) {
            if (isArraySorted(initialUnsortedArray) || isArrayReverseSorted(initialUnsortedArray)) {
                tendencyMessage = "Worst Case O(n²)";
            }
        }

        // Heuristics based on recursion depth and function calls
        // These are approximate and may need tuning
        if (tendencyMessage !== "Worst Case O(n²)") { // Only if not already determined as worst
            const log_n = n > 1 ? Math.log2(n) : 1;
            if (n > 5 && maxRecursionDepth >= n - 2) { // Very deep recursion
                tendencyMessage = "Worst Case O(n²)";
            } else if (n > 10 && maxRecursionDepth > log_n * 3) { // Significantly deeper than log N
                tendencyMessage = "Leaning towards Worst Case O(n²) due to unbalanced partitions.";
            } else if (currentPivotStrategy === 'random' || currentPivotStrategy === 'medianOfThree') {
                tendencyMessage = "Best/Average Case O(n log n) (expected with this pivot strategy)";
            }
        }
        observedPerformanceTendencyP.textContent = `Observed Performance Tendency: ${tendencyMessage}`;
    }


    function prepareQuickSort() {
        animationSteps = [];
        functionCalls = 0;
        maxRecursionDepth = 0;

        const arrayForSorting = workingArray.slice();

        currentRecursionTreeRoot = {
            id: `call-${functionCalls}`,
            label: `T(${arrayForSorting.length})`,
            low: 0,
            high: arrayForSorting.length - 1,
            depth: 0,
            cost: arrayForSorting.length,
            children: []
        };

        quickSortRecursive(arrayForSorting, 0, arrayForSorting.length - 1, 0, currentRecursionTreeRoot);

        let finalArrayState = workingArray.slice();
        if (animationSteps.length > 0) {
            for (let i = animationSteps.length - 1; i >= 0; i--) {
                if (animationSteps[i].arrayState) {
                    finalArrayState = animationSteps[i].arrayState;
                    break;
                }
            }
        }
        animationSteps.push({ type: 'sort_complete', message: 'Array Sorted!', arrayState: finalArrayState });

        updateStatus(`Ready to visualize ${animationSteps.length} steps.`);
        recursionDepthSpan.textContent = maxRecursionDepth;
        functionCallsSpan.textContent = functionCalls;
        renderRecursionTree(currentRecursionTreeRoot, recursionTreeContainer);

        analyzeAndDisplayPerformanceTendency(); // NEW: Call analysis here
    }

    function quickSortRecursive(arr, low, high, depth, parentTreeNode) {
        functionCalls++;
        maxRecursionDepth = Math.max(maxRecursionDepth, depth);

        animationSteps.push({
            type: 'recursive_call_start',
            low, high, depth,
            arrayState: arr.slice(),
            treeNodeId: parentTreeNode.id
        });

        if (low < high) {
            const partitionResult = partition(arr, low, high, parentTreeNode);
            const pi = partitionResult.pivotIndex;

            const leftSize = pi - low;
            const rightSize = high - pi;

            const leftChildTreeNode = (pi - 1 >= low) ? {
                id: `call-${functionCalls}`,
                label: `T(${leftSize})`,
                low: low, high: pi - 1,
                depth: depth + 1,
                cost: leftSize,
                children: []
            } : null;
            if (leftChildTreeNode) parentTreeNode.children.push(leftChildTreeNode);

            const rightChildTreeNode = (pi + 1 <= high) ? {
                id: `call-${functionCalls + (leftChildTreeNode ? 1 : 0)}`, // Ensure unique ID
                label: `T(${rightSize})`,
                low: pi + 1, high: high,
                depth: depth + 1,
                cost: rightSize,
                children: []
            } : null;
            if (rightChildTreeNode) parentTreeNode.children.push(rightChildTreeNode);

            if (leftChildTreeNode) {
                quickSortRecursive(arr, low, pi - 1, depth + 1, leftChildTreeNode);
            }
            if (rightChildTreeNode) {
                quickSortRecursive(arr, pi + 1, high, depth + 1, rightChildTreeNode);
            }

            let sortedIndicesInPartition = [];
            for (let k = low; k <= high; k++) sortedIndicesInPartition.push(k);
            animationSteps.push({
                type: 'partition_complete',
                low, high,
                pivotFinalIndex: pi,
                sortedIndices: sortedIndicesInPartition,
                arrayState: arr.slice()
            });

        } else if (low === high && low >= 0 && low < arr.length) {
            animationSteps.push({
                type: 'partition_complete',
                low, high,
                pivotFinalIndex: low,
                sortedIndices: [low],
                arrayState: arr.slice()
            });
        }
        animationSteps.push({ type: 'recursive_call_end', low, high, treeNodeId: parentTreeNode.id, arrayState: arr.slice() });
    }

    function partition(arr, low, high, currentTreeNode) {
        const pivotStrategy = pivotStrategySelect.value;
        let pivotIndex;
        let pivotValue;

        animationSteps.push({ type: 'status_update', message: `Partitioning arr[${low}..${high}]. Strategy: ${pivotStrategy}`, low, high, arrayState: arr.slice() });

        if (pivotStrategy === 'first') {
            pivotIndex = low;
        } else if (pivotStrategy === 'last') {
            pivotIndex = high;
        } else if (pivotStrategy === 'random') {
            pivotIndex = Math.floor(Math.random() * (high - low + 1)) + low;
        } else if (pivotStrategy === 'middle') {
            pivotIndex = Math.floor((low + high) / 2);
        } else if (pivotStrategy === 'medianOfThree') {
            if (high - low + 1 < 3) { // If less than 3 elements, default to 'first' or 'last' for simplicity
                pivotIndex = low; // Or high, depends on preference for small arrays
            } else {
                const mid = Math.floor((low + high) / 2);
                animationSteps.push({ type: 'compare_pivot_candidates', indices: [low, mid, high].sort((a, b) => a - b), low, high, arrayState: arr.slice() });
                const candidates = [
                    { val: arr[low], idx: low },
                    { val: arr[mid], idx: mid },
                    { val: arr[high], idx: high }
                ];
                candidates.sort((a, b) => a.val - b.val);
                pivotIndex = candidates[1].idx;
            }
        }
        pivotValue = arr[pivotIndex];
        animationSteps.push({ type: 'pivot_selected', index: pivotIndex, value: pivotValue, low, high, arrayState: arr.slice() });

        if (pivotIndex !== high) {
            animationSteps.push({ type: 'swap_details', indices: [pivotIndex, high], arrayState: arr.slice(), message: `Moving pivot ${arr[pivotIndex]} (at index ${pivotIndex}) to end.` });
            [arr[pivotIndex], arr[high]] = [arr[high], arr[pivotIndex]];
            animationSteps.push({ type: 'after_swap', arrayState: arr.slice(), low, high });
        }
        pivotValue = arr[high]; // Pivot value is now definitely from arr[high]

        let i = low - 1;

        for (let j = low; j < high; j++) {
            animationSteps.push({ type: 'compare', indices: [j, high], low, high, arrayState: arr.slice() });
            if (arr[j] < pivotValue) {
                i++;
                if (i !== j) {
                    animationSteps.push({ type: 'swap_details', indices: [i, j], arrayState: arr.slice(), message: `Swapping ${arr[i]} and ${arr[j]}` });
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    animationSteps.push({ type: 'after_swap', arrayState: arr.slice(), low, high });
                }
            }
        }

        animationSteps.push({ type: 'swap_details', indices: [i + 1, high], arrayState: arr.slice(), message: `Placing pivot ${arr[high]} in correct position.` });
        [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        const finalPivotIndex = i + 1;
        animationSteps.push({ type: 'pivot_placed', index: finalPivotIndex, low, high, arrayState: arr.slice() });

        if (currentTreeNode) {
            currentTreeNode.cost = (high - low + 1);
        }
        return { pivotIndex: finalPivotIndex };
    }

    // --- Animation Execution ---
    function executeNextStep() {
        if (currentStepIndex >= animationSteps.length) {
            updateStatus('Sorting complete!');
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.disabled = true;
            nextStepButton.disabled = true;
            if (workingArray && workingArray.length > 0) {
                displayArray(workingArray, { sortedPartition: workingArray.map((_, idx) => idx) });
            }
            return;
        }

        const step = animationSteps[currentStepIndex];
        let highlights = {};
        let arrayToDisplay = step.arrayState ? step.arrayState.slice() : workingArray.slice();


        document.querySelectorAll('.tree-node.active-call').forEach(el => el.classList.remove('active-call'));
        if (step.treeNodeId) {
            const activeNodeEl = document.getElementById(step.treeNodeId + '-node');
            if (activeNodeEl) activeNodeEl.classList.add('active-call');
        }

        if (typeof step.low === 'number' && typeof step.high === 'number') {
            highlights.subArray = { low: step.low, high: step.high };
        }

        switch (step.type) {
            case 'status_update':
                updateStatus(step.message);
                break;
            case 'pivot_selected':
                updateStatus(`Pivot selected: ${step.value} (index ${step.index}) for arr[${step.low}..${step.high}]`);
                highlights.pivot = step.index;
                break;
            case 'compare_pivot_candidates':
                updateStatus(`Comparing median-of-three candidates: ${step.indices.map(i => arrayToDisplay[i]).join(', ')}`);
                highlights.comparing = step.indices;
                break;
            case 'compare':
                updateStatus(`Comparing ${arrayToDisplay[step.indices[0]]} with pivot ${arrayToDisplay[step.indices[1]]}`);
                highlights.comparing = [step.indices[0]];
                highlights.pivot = step.indices[1];
                break;
            case 'swap_details':
                updateStatus(step.message || `Swapping elements at indices ${step.indices[0]} and ${step.indices[1]}`);
                highlights.swapping = step.indices;
                break;
            case 'after_swap':
                updateStatus('Swap complete.');
                break;
            case 'pivot_placed':
                updateStatus(`Pivot ${arrayToDisplay[step.index]} placed at index ${step.index}.`);
                highlights.pivot = step.index;
                highlights.sortedPartition = [step.index];
                break;
            case 'recursive_call_start':
                updateStatus(`Recursive call for arr[${step.low}..${step.high}], depth ${step.depth}`);
                break;
            case 'recursive_call_end':
                updateStatus(`Returning from call for arr[${step.low}..${step.high}]`);
                break;
            case 'partition_complete':
                updateStatus(`Partition arr[${step.low}..${step.high}] complete. Pivot at ${step.pivotFinalIndex}.`);
                highlights.sortedPartition = step.sortedIndices;
                highlights.pivot = step.pivotFinalIndex;
                break;
            case 'sort_complete':
                updateStatus(step.message);
                highlights.sortedPartition = arrayToDisplay.map((_, idx) => idx);
                if (autoPlayInterval) clearInterval(autoPlayInterval);
                autoPlayButton.textContent = 'Auto Play';
                autoPlayButton.disabled = true;
                nextStepButton.disabled = true;
                // The observed performance is set in prepareQuickSort, so it should be visible
                break;
        }

        displayArray(arrayToDisplay, highlights);

        if (step.arrayState) {
            workingArray = step.arrayState.slice();
        }

        currentStepIndex++;
        if (currentStepIndex >= animationSteps.length) {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.disabled = true;
            nextStepButton.disabled = true;
        }
    }

    // --- Recursion Tree Display ---
    function renderRecursionTree(node, containerElement) {
        containerElement.innerHTML = '';
        if (!node) return;

        const treeRootUl = document.createElement('ul');
        treeRootUl.style.listStyleType = 'none';
        treeRootUl.style.paddingLeft = '0';

        buildTreeDOM(node, treeRootUl);
        containerElement.appendChild(treeRootUl);
    }

    function buildTreeDOM(treeNode, parentUlElement) {
        if (!treeNode || (typeof treeNode.cost === 'number' && treeNode.cost <= 0 && treeNode.label !== `T(0)` && treeNode.label !== `T(1)`)) {
            if (treeNode.label === 'T(0)') return;
        }


        const listItem = document.createElement('li');
        listItem.classList.add('tree-node');
        listItem.id = treeNode.id + '-node';

        const nodeLabel = document.createElement('span');
        nodeLabel.classList.add('node-label');
        nodeLabel.textContent = `${treeNode.label}`;
        if (typeof treeNode.cost === 'number' && treeNode.cost > 0) {
            nodeLabel.textContent += ` (cost: ${treeNode.cost})`;
        }
        listItem.appendChild(nodeLabel);

        const rangeSpan = document.createElement('span');
        rangeSpan.textContent = ` [${treeNode.low}-${treeNode.high}]`;
        rangeSpan.style.fontSize = '0.8em';
        rangeSpan.style.color = '#555';
        listItem.appendChild(rangeSpan);

        parentUlElement.appendChild(listItem);

        if (treeNode.children && treeNode.children.length > 0) {
            const childrenUl = document.createElement('ul');
            childrenUl.style.listStyleType = 'none';
            childrenUl.style.paddingLeft = '20px';
            treeNode.children.forEach(childNode => {
                if (childNode && (childNode.cost > 0 || childNode.label === 'T(1)')) {
                    buildTreeDOM(childNode, childrenUl);
                }
            });
            if (childrenUl.hasChildNodes()) {
                listItem.appendChild(childrenUl);
            }
        }
    }


    // --- Quiz Mode ---
    const quizData = [
        {
            question: "What is the worst-case time complexity of Quick Sort?",
            options: ["O(n log n)", "O(n)", "O(n^2)", "O(log n)"],
            answer: "O(n^2)"
        },
        {
            question: "When does the worst-case for Quick Sort typically occur?",
            options: ["When the array is random", "When the pivot always picks the smallest or largest element", "When the array is already sorted (using first/last element as pivot)", "Both B and C"],
            answer: "Both B and C"
        },
        {
            question: "What is the average-case time complexity of Quick Sort?",
            options: ["O(n^2)", "O(n log n)", "O(n)", "O(1)"],
            answer: "O(n log n)"
        },
        {
            question: "Which pivot strategy is generally good at avoiding worst-case scenarios?",
            options: ["Always first element", "Always last element", "Random pivot or Median-of-three", "Always middle element"],
            answer: "Random pivot or Median-of-three"
        },
        {
            question: "Is Quick Sort a stable sorting algorithm?",
            options: ["Yes", "No"],
            answer: "No"
        }
    ];
    let currentQuizQuestionIndex = -1;
    let score = 0;

    function loadQuizQuestion() {
        currentQuizQuestionIndex++;
        if (currentQuizQuestionIndex >= quizData.length) {
            quizQuestionDiv.textContent = `Quiz Finished! Your score: ${score}/${quizData.length}`;
            quizOptionsDiv.innerHTML = '';
            submitAnswerButton.style.display = 'none';
            quizFeedbackDiv.textContent = '';
            const restartQuizButton = document.createElement('button');
            restartQuizButton.textContent = 'Restart Quiz';
            restartQuizButton.onclick = () => { currentQuizQuestionIndex = -1; score = 0; submitAnswerButton.style.display = 'inline-block'; loadQuizQuestion(); };
            quizOptionsDiv.appendChild(restartQuizButton);
            return;
        }

        const q = quizData[currentQuizQuestionIndex];
        quizQuestionDiv.textContent = q.question;
        quizOptionsDiv.innerHTML = '';
        q.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.onclick = () => {
                quizOptionsDiv.querySelectorAll('button').forEach(btn => {
                    btn.style.backgroundColor = '#f0f0f0'; // Reset previous selection
                    btn.style.color = '#333';
                    delete btn.dataset.selected;
                });
                button.style.backgroundColor = '#a0c4ff'; // Highlight selected
                button.style.color = '#000';
                button.dataset.selected = "true";
            };
            quizOptionsDiv.appendChild(button);
        });
        submitAnswerButton.style.display = 'inline-block';
        quizFeedbackDiv.textContent = '';
    }

    submitAnswerButton.addEventListener('click', () => {
        const selectedOptionButton = quizOptionsDiv.querySelector('button[data-selected="true"]');
        if (!selectedOptionButton) {
            quizFeedbackDiv.textContent = "Please select an answer.";
            quizFeedbackDiv.style.color = "red";
            return;
        }

        const selectedAnswer = selectedOptionButton.textContent;
        const correctAnswer = quizData[currentQuizQuestionIndex].answer;

        if (selectedAnswer === correctAnswer) {
            quizFeedbackDiv.textContent = "Correct!";
            quizFeedbackDiv.style.color = "green";
            score++;
        } else {
            quizFeedbackDiv.textContent = `Incorrect. Correct answer: ${correctAnswer}`;
            quizFeedbackDiv.style.color = "red";
        }

        // Disable options after answering and show correct/incorrect styling
        quizOptionsDiv.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correctAnswer) {
                btn.style.backgroundColor = 'lightgreen'; // Correct answer
            } else if (btn.dataset.selected === "true" && btn.textContent !== correctAnswer) {
                btn.style.backgroundColor = 'lightcoral'; // Incorrectly selected answer
            }
        });


        setTimeout(() => {
            quizOptionsDiv.querySelectorAll('button').forEach(btn => btn.disabled = false);
            loadQuizQuestion();
        }, 2000); // Increased delay to see feedback
    });

    function resetQuiz() {
        currentQuizQuestionIndex = -1;
        score = 0;
        quizFeedbackDiv.textContent = '';
        quizOptionsDiv.innerHTML = '';
        submitAnswerButton.style.display = 'inline-block';
        loadQuizQuestion();
    }

    // Initialize
    resetVisualization();
});