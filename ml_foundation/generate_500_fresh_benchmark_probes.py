"""
VISION FOUNDATION MODEL — 500 FRESH HELD-OUT INDEPENDENT BENCHMARK SUITE GENERATOR
Generates 500 diverse, multi-difficulty probes across 13 core capability domains.
All probes are held out from the training corpus and evaluate native capability without external tools.
"""

import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(REPO_ROOT, "vision_fresh_validation_dataset_500.jsonl")


def build_500_probes():
    probes = []
    pid = 1

    # 1. Mathematics & Arithmetic (40 probes)
    math_items = [
        ("Calculate 48 + 37.", "85", ["85"], "elementary"),
        ("What is 125 minus 68?", "57", ["57"], "elementary"),
        ("What is 16 multiplied by 14?", "224", ["224"], "elementary"),
        ("What is 343 divided by 7?", "49", ["49"], "elementary"),
        ("What is 15 squared (15^2)?", "225", ["225"], "elementary"),
        ("What is the cube root of 512?", "8", ["8"], "intermediate"),
        ("Solve for x: 5x - 20 = 45.", "13", ["13", "x = 13", "x=13"], "elementary"),
        ("Solve for y: 3y + 12 = 0.", "-4", ["-4", "y = -4", "y=-4"], "elementary"),
        ("Simplify the fraction 36/48 to its lowest terms.", "3/4", ["3/4"], "elementary"),
        ("What is 25% of 360?", "90", ["90"], "elementary"),
        ("If a rectangle has length 12 cm and width 7 cm, what is its area?", "84", ["84", "84 cm^2", "84 sq cm"], "elementary"),
        ("What is the perimeter of a square with side length 9 cm?", "36", ["36", "36 cm"], "elementary"),
        ("What is the sum of angles in any triangle in degrees?", "180", ["180", "180 degrees", "180°"], "elementary"),
        ("Find x if 2^x = 64.", "6", ["6", "x = 6", "x=6"], "intermediate"),
        ("What is the greatest common divisor (GCD) of 48 and 72?", "24", ["24"], "intermediate"),
        ("What is the least common multiple (LCM) of 6 and 8?", "24", ["24"], "intermediate"),
        ("Calculate the value of 7! (7 factorial).", "5040", ["5040"], "intermediate"),
        ("If log10(x) = 3, what is the value of x?", "1000", ["1000"], "intermediate"),
        ("What is the slope of the line y = 4x - 9?", "4", ["4", "m = 4"], "elementary"),
        ("Find the roots of the equation x^2 - 9 = 0.", "3 and -3", ["3", "-3", "+3 and -3", "+-3"], "intermediate"),
        ("A car travels 180 km in 3 hours. What is its speed in km/h?", "60", ["60", "60 km/h", "60 km/hr"], "elementary"),
        ("What is the hypotenuse of a right triangle with legs 6 and 8?", "10", ["10"], "intermediate"),
        ("Convert 0.75 into a fraction.", "3/4", ["3/4"], "elementary"),
        ("What is 2/3 + 1/6?", "5/6", ["5/6"], "intermediate"),
        ("What is 5/8 minus 1/4?", "3/8", ["3/8"], "intermediate"),
        ("What is 3/5 multiplied by 5/9?", "1/3", ["1/3"], "intermediate"),
        ("What is the median of the set [3, 7, 9, 15, 21]?", "9", ["9"], "elementary"),
        ("What is the mean of the numbers 10, 20, 30, 40, 50?", "30", ["30"], "elementary"),
        ("If a shirt costs $80 with a 20% discount, what is the sale price?", "64", ["64", "$64"], "intermediate"),
        ("What is 2 to the power of 10 (2^10)?", "1024", ["1024"], "intermediate"),
        ("Find x: 2(x + 4) = 22.", "7", ["7", "x = 7", "x=7"], "intermediate"),
        ("What is the volume of a cube with side length 5 cm?", "125", ["125", "125 cm^3"], "intermediate"),
        ("How many degrees are in a full circle?", "360", ["360", "360 degrees", "360°"], "elementary"),
        ("What is 100 divided by 0.5?", "200", ["200"], "elementary"),
        ("What is the probability of rolling a 6 on a fair six-sided die?", "1/6", ["1/6"], "intermediate"),
        ("If 3 pencils cost 15 cents, how much do 7 pencils cost?", "35", ["35", "35 cents"], "elementary"),
        ("What is the next number in the arithmetic sequence 4, 9, 14, 19, ...?", "24", ["24"], "elementary"),
        ("What is the next number in the geometric sequence 3, 6, 12, 24, ...?", "48", ["48"], "elementary"),
        ("Solve for x: x/4 = 16.", "64", ["64", "x = 64"], "elementary"),
        ("What is the square of 25?", "625", ["625"], "elementary"),
    ]
    for prompt, ans, kws, diff in math_items:
        probes.append({
            "probe_id": f"FRESH-MATH-{pid:03d}",
            "domain": "mathematics",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 2. Python Programming (40 probes)
    py_items = [
        ("In Python, which keyword is used to define a function?", "def", ["def"], "elementary"),
        ("Which keyword is used to create an anonymous inline function in Python?", "lambda", ["lambda"], "elementary"),
        ("What built-in function returns the number of items in a list?", "len", ["len", "len()"], "elementary"),
        ("How do you add an element to the end of a list in Python?", "append", ["append", "append()", ".append"], "elementary"),
        ("What data type represents immutable ordered sequences of elements in Python?", "tuple", ["tuple"], "elementary"),
        ("Which module in standard library is used for regular expressions?", "re", ["re"], "elementary"),
        ("What keyword is used to handle exceptions in a try block?", "except", ["except"], "elementary"),
        ("How do you convert the string '123' to an integer in Python?", "int('123')", ["int", "int()"], "elementary"),
        ("What method removes and returns the last element of a list?", "pop", ["pop", "pop()", ".pop"], "elementary"),
        ("Which keyword is used to import code from another module?", "import", ["import"], "elementary"),
        ("What is the boolean result of 5 in [1, 2, 3, 4, 5] in Python?", "True", ["True"], "elementary"),
        ("Which built-in type stores unique, unordered elements in Python?", "set", ["set"], "elementary"),
        ("What method returns all the keys of a dictionary?", "keys", ["keys", "keys()", ".keys"], "elementary"),
        ("What keyword defines a class in Python?", "class", ["class"], "elementary"),
        ("What special method is the constructor of a Python class?", "__init__", ["__init__", "__init__()"], "elementary"),
        ("What built-in function generates a sequence of numbers from start to stop?", "range", ["range", "range()"], "elementary"),
        ("What keyword exits immediately from a while or for loop in Python?", "break", ["break"], "elementary"),
        ("What keyword skips the rest of the current loop iteration and proceeds to the next?", "continue", ["continue"], "elementary"),
        ("What decorator is used to define a static method inside a class?", "@staticmethod", ["@staticmethod", "staticmethod"], "intermediate"),
        ("Which built-in function returns both the index and value when iterating a list?", "enumerate", ["enumerate", "enumerate()"], "intermediate"),
        ("What exception is raised when dividing a number by zero in Python?", "ZeroDivisionError", ["ZeroDivisionError"], "intermediate"),
        ("What exception is raised when accessing a non-existent key in a dictionary?", "KeyError", ["KeyError"], "intermediate"),
        ("What exception is raised when trying to access an index out of bounds in a list?", "IndexError", ["IndexError"], "intermediate"),
        ("How do you open a file for writing in Python?", "open(filename, 'w')", ["'w'", "\"w\"", "open"], "intermediate"),
        ("Which statement ensures a file is automatically closed after use?", "with", ["with", "with statement"], "intermediate"),
        ("What keyword is used inside a function to create a generator?", "yield", ["yield"], "intermediate"),
        ("What built-in function sorts an iterable and returns a new list?", "sorted", ["sorted", "sorted()"], "intermediate"),
        ("How do you check the type of an object in Python?", "type() or isinstance()", ["type", "isinstance"], "intermediate"),
        ("What module in standard library handles mathematical operations like sqrt and cos?", "math", ["math"], "elementary"),
        ("What module in Python standard library provides json serialization and parsing?", "json", ["json"], "elementary"),
        ("What method serializes a Python object to a JSON string?", "json.dumps", ["json.dumps", "dumps"], "intermediate"),
        ("What method deserializes a JSON string to a Python dictionary?", "json.loads", ["json.loads", "loads"], "intermediate"),
        ("What operator performs floor division in Python?", "//", ["//"], "elementary"),
        ("What operator performs exponentiation in Python?", "**", ["**"], "elementary"),
        ("What string method converts all characters to lowercase in Python?", "lower", ["lower", "lower()", ".lower"], "elementary"),
        ("What string method splits a string into a list of words?", "split", ["split", "split()", ".split"], "elementary"),
        ("What string method joins elements of an iterable with a separator?", "join", ["join", "join()", ".join"], "elementary"),
        ("What keyword is used to inherit from a parent class in Python? (e.g. class Child(Parent):)", "class Child(Parent):", ["class Child(Parent)", "Parent", "parentheses"], "intermediate"),
        ("Which module provides datetime classes in Python?", "datetime", ["datetime"], "elementary"),
        ("What is the result of type([]) in Python?", "list", ["list", "<class 'list'>"], "elementary")
    ]
    for prompt, ans, kws, diff in py_items:
        probes.append({
            "probe_id": f"FRESH-PYTHON-{pid:03d}",
            "domain": "programming_python",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 3. JavaScript / Web Development (40 probes)
    js_items = [
        ("In JavaScript, which keyword declares a block-scoped constant?", "const", ["const"], "elementary"),
        ("Which keyword declares a reassignable block-scoped variable in modern JavaScript?", "let", ["let"], "elementary"),
        ("What method adds one or more elements to the end of an array in JavaScript?", "push", ["push", "push()", ".push"], "elementary"),
        ("What method removes and returns the last element of an array in JavaScript?", "pop", ["pop", "pop()", ".pop"], "elementary"),
        ("What method transforms every element in an array using a callback and returns a new array?", "map", ["map", "map()", ".map"], "elementary"),
        ("What method creates a new array with all elements that pass a test condition?", "filter", ["filter", "filter()", ".filter"], "elementary"),
        ("What property returns the number of elements in a JavaScript array?", "length", ["length", ".length"], "elementary"),
        ("What function parses a JSON string into a JavaScript object?", "JSON.parse", ["JSON.parse", "JSON.parse()", "parse"], "elementary"),
        ("What function converts a JavaScript object into a JSON string?", "JSON.stringify", ["JSON.stringify", "JSON.stringify()", "stringify"], "elementary"),
        ("What operator checks equality with type coercion in JavaScript?", "==", ["=="], "elementary"),
        ("What operator checks strict equality without type coercion in JavaScript?", "===", ["==="], "elementary"),
        ("What syntax is used for modern arrow functions in JavaScript?", "=>", ["=>", "arrow"], "elementary"),
        ("What object represents the eventual completion or failure of an asynchronous operation?", "Promise", ["Promise", "promise"], "intermediate"),
        ("What keyword pauses the execution of an async function until a Promise settles?", "await", ["await"], "intermediate"),
        ("What keyword declares an asynchronous function that returns a Promise?", "async", ["async"], "intermediate"),
        ("What DOM method selects an element using a CSS selector?", "document.querySelector", ["querySelector", "document.querySelector"], "intermediate"),
        ("What DOM method attaches an event handler to an element?", "addEventListener", ["addEventListener", "addEventListener()"], "intermediate"),
        ("What method converts an integer to a string in JavaScript?", "toString", ["toString", "toString()", ".toString"], "elementary"),
        ("What operator spreads an iterable into individual elements in ES6?", "...", ["...", "spread", "spread operator"], "intermediate"),
        ("What keyword creates an instance of a JavaScript class?", "new", ["new"], "elementary"),
        ("What method executes a callback function for each array element without returning a new array?", "forEach", ["forEach", "forEach()", ".forEach"], "elementary"),
        ("What is the data type of NaN in JavaScript?", "number", ["number"], "intermediate"),
        ("What method searches an array for a specified item and returns its index?", "indexOf", ["indexOf", "indexOf()", ".indexOf"], "elementary"),
        ("What method checks whether an array includes a certain value among its entries?", "includes", ["includes", "includes()", ".includes"], "elementary"),
        ("What DOM property sets or gets the text content of a node and its descendants?", "textContent", ["textContent", ".textContent"], "elementary"),
        ("What function executes code after a specified delay in milliseconds?", "setTimeout", ["setTimeout", "setTimeout()"], "elementary"),
        ("What function repeatedly executes code at a fixed time interval in milliseconds?", "setInterval", ["setInterval", "setInterval()"], "elementary"),
        ("What keyword refers to the current object executing the function in JavaScript?", "this", ["this"], "intermediate"),
        ("What HTTP client function is built natively into modern JavaScript browsers to make network requests?", "fetch", ["fetch", "fetch()", "window.fetch"], "intermediate"),
        ("What method merges two or more arrays without mutating the original arrays?", "concat", ["concat", "concat()", ".concat"], "intermediate"),
        ("What method joins all elements of an array into a single string?", "join", ["join", "join()", ".join"], "elementary"),
        ("What method removes whitespace from both ends of a string in JavaScript?", "trim", ["trim", "trim()", ".trim"], "elementary"),
        ("What method returns the character at a specified index in a string?", "charAt", ["charAt", "charAt()", ".charAt"], "elementary"),
        ("What syntax handles errors in JavaScript synchronous code?", "try...catch", ["try...catch", "try catch", "try"], "elementary"),
        ("What object provides mathematical constants and functions like Math.PI and Math.sqrt?", "Math", ["Math"], "elementary"),
        ("What method rounds a number up to the nearest integer?", "Math.ceil", ["Math.ceil", "ceil"], "elementary"),
        ("What method rounds a number down to the nearest integer?", "Math.floor", ["Math.floor", "floor"], "elementary"),
        ("What method generates a pseudo-random number between 0 and 1 in JavaScript?", "Math.random", ["Math.random", "random"], "elementary"),
        ("What operator is known as the nullish coalescing operator in modern JavaScript?", "??", ["??"], "intermediate"),
        ("What operator is known as the optional chaining operator in modern JavaScript?", "?.", ["?."], "intermediate")
    ]
    for prompt, ans, kws, diff in js_items:
        probes.append({
            "probe_id": f"FRESH-JS-{pid:03d}",
            "domain": "programming_javascript",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 4. Java & Systems OOP (40 probes)
    java_items = [
        ("In Java, which keyword indicates that a method belongs to the class rather than an instance?", "static", ["static"], "elementary"),
        ("What keyword indicates that a variable's value cannot be changed once assigned in Java?", "final", ["final"], "elementary"),
        ("What is the entry point method signature for any standalone Java application?", "public static void main(String[] args)", ["main", "public static void main"], "elementary"),
        ("Which keyword is used to inherit from a superclass in Java?", "extends", ["extends"], "elementary"),
        ("Which keyword is used to implement an interface in Java?", "implements", ["implements"], "elementary"),
        ("What is the root class of all classes in the Java class hierarchy?", "Object", ["Object", "java.lang.Object"], "elementary"),
        ("Which primitive type represents a 32-bit signed integer in Java?", "int", ["int"], "elementary"),
        ("Which primitive type represents a 64-bit signed integer in Java?", "long", ["long"], "elementary"),
        ("Which primitive type represents a 64-bit floating point number in Java?", "double", ["double"], "elementary"),
        ("What keyword instantiates a new object in Java?", "new", ["new"], "elementary"),
        ("What access modifier makes a member accessible only within its own class?", "private", ["private"], "elementary"),
        ("What access modifier makes a member accessible from any other class?", "public", ["public"], "elementary"),
        ("What access modifier makes a member accessible within its package and by subclasses?", "protected", ["protected"], "intermediate"),
        ("What interface in java.util represents an ordered sequence of elements allowing duplicates?", "List", ["List", "java.util.List"], "elementary"),
        ("What interface in java.util represents a collection of unique elements with no duplicates?", "Set", ["Set", "java.util.Set"], "elementary"),
        ("What interface in java.util maps unique keys to values?", "Map", ["Map", "java.util.Map"], "elementary"),
        ("What class is a resizable array implementation of the List interface in Java?", "ArrayList", ["ArrayList"], "elementary"),
        ("What class is a hashtable-based implementation of the Map interface in Java?", "HashMap", ["HashMap"], "elementary"),
        ("What keyword invokes the constructor of the parent class in Java?", "super", ["super", "super()"], "intermediate"),
        ("What keyword refers to the current instance of the class in Java?", "this", ["this"], "elementary"),
        ("What exception is thrown when an application attempts to use null in an object reference?", "NullPointerException", ["NullPointerException"], "elementary"),
        ("What keyword is used to declare an abstract method or class in Java?", "abstract", ["abstract"], "intermediate"),
        ("What mechanism allows multiple methods in the same class to have the same name but different parameters?", "overloading", ["overloading", "method overloading"], "intermediate"),
        ("What mechanism allows a subclass to provide a specific implementation of a method defined in its superclass?", "overriding", ["overriding", "method overriding"], "intermediate"),
        ("What annotation indicates that a method overrides a declaration in a superclass?", "@Override", ["@Override", "Override"], "elementary"),
        ("What package is automatically imported into every Java source file without an import statement?", "java.lang", ["java.lang"], "intermediate"),
        ("What class is used to create mutable sequences of characters in Java for fast string concatenation?", "StringBuilder", ["StringBuilder", "StringBuffer"], "intermediate"),
        ("What keyword is used to explicitly throw an exception in Java?", "throw", ["throw"], "elementary"),
        ("What keyword is used in a method signature to declare that it can throw exceptions?", "throws", ["throws"], "elementary"),
        ("What block always executes after a try-catch block, regardless of whether an exception occurred?", "finally", ["finally"], "elementary"),
        ("What feature introduced in Java 8 allows passing code as arguments using (params) -> body syntax?", "lambda expressions", ["lambda", "lambda expressions"], "intermediate"),
        ("What API introduced in Java 8 supports functional-style operations on streams of elements?", "Stream API", ["Stream", "Stream API", "Streams"], "intermediate"),
        ("What keyword is used to synchronize critical sections for thread safety in Java?", "synchronized", ["synchronized"], "intermediate"),
        ("What interface must be implemented by any class whose instances are intended to be executed by a thread?", "Runnable", ["Runnable"], "intermediate"),
        ("What keyword prevents a field from being serialized in Java?", "transient", ["transient"], "advanced"),
        ("What keyword ensures that multiple threads reading a variable always read its most up-to-date value from main memory?", "volatile", ["volatile"], "advanced"),
        ("What method of Object class is used to compare whether two objects are logically equal?", "equals", ["equals", "equals()", ".equals"], "elementary"),
        ("What method returns the integer hash code representation of an object in Java?", "hashCode", ["hashCode", "hashCode()", ".hashCode"], "elementary"),
        ("What is the default value of a boolean field in a Java class?", "false", ["false"], "elementary"),
        ("What is the size of a byte in bits in Java?", "8", ["8", "8 bits"], "elementary")
    ]
    for prompt, ans, kws, diff in java_items:
        probes.append({
            "probe_id": f"FRESH-JAVA-{pid:03d}",
            "domain": "programming_java",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 5. C & C++ Systems Programming (40 probes)
    c_items = [
        ("In C, which operator returns the memory address of a variable?", "&", ["&", "ampersand", "address-of"], "elementary"),
        ("In C, which operator is used to dereference a pointer to access the value at the address?", "*", ["*", "asterisk", "dereference"], "elementary"),
        ("What function dynamically allocates a block of memory of specified size in C?", "malloc", ["malloc", "malloc()"], "elementary"),
        ("What function releases dynamically allocated memory back to the heap in C?", "free", ["free", "free()"], "elementary"),
        ("What header file must be included in C to use printf and scanf?", "<stdio.h>", ["stdio.h", "<stdio.h>"], "elementary"),
        ("What header file must be included in C to use malloc and free?", "<stdlib.h>", ["stdlib.h", "<stdlib.h>"], "elementary"),
        ("What character terminates every C string in memory?", "\\0", ["\\0", "null terminator", "null character", "zero"], "elementary"),
        ("What operator is used to access a struct member through a pointer in C/C++?", "->", ["->", "arrow", "arrow operator"], "elementary"),
        ("What operator is used to access a struct member directly from an instance in C/C++?", ".", [".", "dot", "period"], "elementary"),
        ("What keyword creates user-defined composite data types grouping multiple variables in C?", "struct", ["struct"], "elementary"),
        ("What keyword creates an alias for an existing data type in C?", "typedef", ["typedef"], "elementary"),
        ("In C++, what operator dynamically allocates memory on the free store?", "new", ["new"], "elementary"),
        ("In C++, what operator deallocates memory allocated with new?", "delete", ["delete"], "elementary"),
        ("In C++, what operator deallocates memory allocated for an array with new[]?", "delete[]", ["delete[]", "delete []"], "elementary"),
        ("What stream object is used for standard console output in C++?", "std::cout", ["cout", "std::cout"], "elementary"),
        ("What stream object is used for standard console input in C++?", "std::cin", ["cin", "std::cin"], "elementary"),
        ("What header file must be included in C++ for cout and cin?", "<iostream>", ["iostream", "<iostream>"], "elementary"),
        ("In C++, what keyword enables dynamic polymorphism and late binding for a member function?", "virtual", ["virtual"], "intermediate"),
        ("In C++, what is a destructor method name preceded by?", "~", ["~", "tilde"], "elementary"),
        ("What C++ keyword prevents an object from being modified by a function?", "const", ["const"], "elementary"),
        ("What C++ smart pointer in <memory> maintains exclusive ownership of a dynamically allocated object?", "std::unique_ptr", ["unique_ptr", "std::unique_ptr"], "intermediate"),
        ("What C++ smart pointer maintains shared ownership using reference counting?", "std::shared_ptr", ["shared_ptr", "std::shared_ptr"], "intermediate"),
        ("What C++ standard library container represents a dynamic contiguous array?", "std::vector", ["vector", "std::vector"], "elementary"),
        ("What C++ standard library container implements a key-value associative map using balanced binary trees?", "std::map", ["map", "std::map"], "intermediate"),
        ("What C++ container implements an associative key-value map using hash tables?", "std::unordered_map", ["unordered_map", "std::unordered_map"], "intermediate"),
        ("What keyword defines a generic class or function that works with any data type in C++?", "template", ["template"], "intermediate"),
        ("What scope resolution operator is used in C++ to access namespace or class scope?", "::", ["::", "double colon", "scope resolution"], "elementary"),
        ("What function reallocates memory to a new size in C?", "realloc", ["realloc", "realloc()"], "intermediate"),
        ("What function allocates memory and initializes all bytes to zero in C?", "calloc", ["calloc", "calloc()"], "intermediate"),
        ("What is the return value of main in C to signify successful execution?", "0", ["0", "EXIT_SUCCESS"], "elementary"),
        ("What C keyword specifies that a variable can be modified outside the current thread or program flow?", "volatile", ["volatile"], "advanced"),
        ("What preprocessor directive defines a macro or constant value in C?", "#define", ["#define", "define"], "elementary"),
        ("What preprocessor directive checks if a macro has already been defined to avoid duplicate inclusion?", "#ifndef", ["#ifndef", "ifndef"], "intermediate"),
        ("In C, what is the size of char in bytes according to the standard?", "1", ["1", "1 byte"], "elementary"),
        ("What format specifier does printf use to print a floating-point number?", "%f", ["%f"], "elementary"),
        ("What format specifier does printf use to print an integer?", "%d", ["%d", "%i"], "elementary"),
        ("What format specifier does printf use to print a string?", "%s", ["%s"], "elementary"),
        ("What C++ standard concept allows passing an lvalue as an rvalue reference to enable move semantics?", "std::move", ["std::move", "move"], "advanced"),
        ("What standard algorithm in <algorithm> sorts elements in a range?", "std::sort", ["sort", "std::sort"], "elementary"),
        ("What C function calculates the length of a null-terminated string?", "strlen", ["strlen", "strlen()"], "elementary")
    ]
    for prompt, ans, kws, diff in c_items:
        probes.append({
            "probe_id": f"FRESH-C-CPP-{pid:03d}",
            "domain": "programming_cpp",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 6. Data Structures & Algorithms (40 probes)
    dsa_items = [
        ("What is the worst-case time complexity of Linear Search on an array of size n?", "O(n)", ["O(n)"], "elementary"),
        ("What is the worst-case time complexity of Binary Search on a sorted array of size n?", "O(log n)", ["O(log n)", "O(logn)"], "elementary"),
        ("What is the average time complexity of Merge Sort?", "O(n log n)", ["O(n log n)", "O(nlogn)"], "elementary"),
        ("What is the worst-case time complexity of Quick Sort?", "O(n^2)", ["O(n^2)", "O(n2)"], "intermediate"),
        ("What data structure operates on a Last-In First-Out (LIFO) basis?", "Stack", ["Stack", "stack"], "elementary"),
        ("What data structure operates on a First-In First-Out (FIFO) basis?", "Queue", ["Queue", "queue"], "elementary"),
        ("What operation adds an element to the top of a stack?", "push", ["push"], "elementary"),
        ("What operation removes an element from the top of a stack?", "pop", ["pop"], "elementary"),
        ("What operation adds an element to the back of a queue?", "enqueue", ["enqueue", "push"], "elementary"),
        ("What operation removes an element from the front of a queue?", "dequeue", ["dequeue", "pop"], "elementary"),
        ("What algorithm finds the shortest path between nodes in a weighted graph with non-negative edge weights?", "Dijkstra's algorithm", ["Dijkstra", "Dijkstra's"], "intermediate"),
        ("What algorithm finds the minimum spanning tree of a connected, undirected graph using edge weights in greedy order?", "Kruskal's algorithm", ["Kruskal", "Kruskal's", "Prim's", "Prim"], "intermediate"),
        ("What graph traversal algorithm uses a queue to visit nodes layer by layer?", "Breadth-First Search (BFS)", ["BFS", "Breadth-First Search", "breadth first search"], "elementary"),
        ("What graph traversal algorithm uses a stack or recursion to explore as far as possible along each branch?", "Depth-First Search (DFS)", ["DFS", "Depth-First Search", "depth first search"], "elementary"),
        ("What is the average time complexity of lookup in a Hash Table?", "O(1)", ["O(1)"], "elementary"),
        ("What is the worst-case time complexity of lookup in a Hash Table when collisions occur?", "O(n)", ["O(n)"], "intermediate"),
        ("What self-balancing binary search tree maintains a height difference between left and right subtrees of at most 1?", "AVL tree", ["AVL", "AVL tree"], "intermediate"),
        ("What data structure is commonly used to implement a Priority Queue?", "Heap", ["Heap", "Binary Heap", "heap"], "intermediate"),
        ("What is the time complexity to find the maximum element in a Max-Heap?", "O(1)", ["O(1)"], "elementary"),
        ("What is the time complexity to insert an element into a binary heap of size n?", "O(log n)", ["O(log n)", "O(logn)"], "intermediate"),
        ("What algorithmic paradigm solves problems by breaking them into overlapping subproblems and storing the results?", "Dynamic Programming", ["Dynamic Programming", "DP", "dynamic programming"], "intermediate"),
        ("What algorithmic technique solves a problem by making the locally optimal choice at each step?", "Greedy algorithm", ["Greedy", "greedy", "Greedy algorithm"], "elementary"),
        ("What algorithm is used to detect cycles in a linked list using two pointers moving at different speeds?", "Floyd's Cycle-Finding Algorithm (Tortoise and Hare)", ["Floyd", "tortoise and hare", "Floyd's"], "intermediate"),
        ("What is the space complexity of iterative binary search?", "O(1)", ["O(1)"], "elementary"),
        ("What is the time complexity of Bubble Sort in the worst case?", "O(n^2)", ["O(n^2)", "O(n2)"], "elementary"),
        ("What data structure consists of nodes where each node points to both its predecessor and successor?", "Doubly Linked List", ["Doubly Linked List", "doubly linked list"], "elementary"),
        ("What tree traversal visits the left subtree, then the root node, then the right subtree?", "In-order traversal", ["In-order", "in-order", "inorder"], "elementary"),
        ("What tree traversal visits the root node, then the left subtree, then the right subtree?", "Pre-order traversal", ["Pre-order", "pre-order", "preorder"], "elementary"),
        ("What tree traversal visits the left subtree, then the right subtree, and finally the root node?", "Post-order traversal", ["Post-order", "post-order", "postorder"], "elementary"),
        ("What is the height of a balanced binary tree containing n nodes?", "O(log n)", ["O(log n)", "O(logn)", "log n"], "elementary"),
        ("What collision resolution technique stores all elements hashing to the same slot in a linked list?", "Chaining (Separate Chaining)", ["Chaining", "Separate Chaining", "chaining"], "intermediate"),
        ("What collision resolution technique probes sequential slots in the hash table until an empty slot is found?", "Linear Probing", ["Linear Probing", "linear probing", "open addressing"], "intermediate"),
        ("What algorithm finds the shortest paths between all pairs of vertices in a weighted graph?", "Floyd-Warshall algorithm", ["Floyd-Warshall", "Floyd Warshall"], "advanced"),
        ("What algorithm finds single-source shortest paths in a graph that may contain negative weight edges?", "Bellman-Ford algorithm", ["Bellman-Ford", "Bellman Ford"], "advanced"),
        ("What data structure tracks elements partitioned into a number of disjoint subsets with union and find operations?", "Disjoint Set Union (DSU / Union-Find)", ["Disjoint Set", "Union-Find", "DSU"], "intermediate"),
        ("What is the maximum number of children a node can have in a Binary Tree?", "2", ["2", "two"], "elementary"),
        ("In Big-O notation, what term describes algorithms with O(2^n) time complexity?", "Exponential time", ["Exponential", "exponential"], "elementary"),
        ("In Big-O notation, what term describes algorithms with O(n!) time complexity?", "Factorial time", ["Factorial", "factorial"], "elementary"),
        ("What string matching algorithm preprocesses the pattern to skip characters using a failure table in O(n + m) time?", "Knuth-Morris-Pratt (KMP)", ["KMP", "Knuth-Morris-Pratt"], "advanced"),
        ("What is the in-order traversal of a valid Binary Search Tree guaranteed to produce?", "A sorted sequence in ascending order", ["sorted", "ascending"], "intermediate")
    ]
    for prompt, ans, kws, diff in dsa_items:
        probes.append({
            "probe_id": f"FRESH-DSA-{pid:03d}",
            "domain": "algorithms",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 7. Computer Science & Operating Systems (40 probes)
    os_items = [
        ("What is an instance of a computer program in execution called in an operating system?", "Process", ["Process", "process"], "elementary"),
        ("What is the smallest unit of execution that can be managed independently by an OS scheduler within a process?", "Thread", ["Thread", "thread"], "elementary"),
        ("What condition occurs when two or more processes are unable to proceed because each is waiting for the other to release a resource?", "Deadlock", ["Deadlock", "deadlock"], "elementary"),
        ("Which of the following is NOT one of the four Coffman conditions for deadlock: Mutual Exclusion, Hold and Wait, No Preemption, Starvation?", "Starvation", ["Starvation"], "intermediate"),
        ("What CPU scheduling algorithm assigns a fixed time slice (quantum) to each process in cyclic order?", "Round Robin", ["Round Robin", "round robin"], "elementary"),
        ("What hardware mechanism maps virtual addresses to physical addresses in memory?", "Memory Management Unit (MMU)", ["MMU", "Memory Management Unit"], "intermediate"),
        ("What type of memory uses disk space to extend physical RAM when memory is exhausted?", "Virtual Memory", ["Virtual Memory", "virtual memory", "swap"], "elementary"),
        ("What exception is generated by the CPU when an accessed page is not currently loaded in physical RAM?", "Page Fault", ["Page Fault", "page fault"], "intermediate"),
        ("What operating system component manages hardware access and runs in privileged kernel mode?", "Kernel", ["Kernel", "kernel"], "elementary"),
        ("What software layer sits between the operating system and hardware devices to control peripheral communication?", "Device Driver", ["Device Driver", "driver"], "elementary"),
        ("What program interface allows a user application to request services directly from the operating system kernel?", "System Call", ["System Call", "system call", "syscall"], "elementary"),
        ("In Linux, which system call creates a new child process by duplicating the calling process?", "fork", ["fork", "fork()"], "elementary"),
        ("In Linux, which family of system calls replaces the current process image with a new executable?", "exec", ["exec", "execve", "execvp"], "intermediate"),
        ("In Linux, which system call causes a parent process to pause until one of its children terminates?", "wait", ["wait", "waitpid"], "intermediate"),
        ("What command in Linux lists active processes currently running on the system?", "ps", ["ps", "top", "htop"], "elementary"),
        ("What command in Linux terminates a process by sending a signal?", "kill", ["kill"], "elementary"),
        ("What signal number corresponds to SIGKILL (unconditional process termination) in Linux?", "9", ["9", "SIGKILL"], "elementary"),
        ("What synchronization primitive integer variable controls access to a common resource by multiple processes?", "Semaphore", ["Semaphore", "semaphore"], "intermediate"),
        ("What synchronization object allows only one thread to access a critical section at a time?", "Mutex", ["Mutex", "mutex", "mutual exclusion"], "elementary"),
        ("What file system data structure in Unix stores metadata about a file such as size, permissions, and block pointers?", "Inode", ["Inode", "inode"], "intermediate"),
        ("What Linux command displays the current working directory path?", "pwd", ["pwd"], "elementary"),
        ("What Linux command changes file permissions?", "chmod", ["chmod"], "elementary"),
        ("What Linux command changes file ownership (user/group)?", "chown", ["chown"], "elementary"),
        ("What Linux command creates a new directory?", "mkdir", ["mkdir"], "elementary"),
        ("What Linux command creates an empty file or updates an existing file's timestamp?", "touch", ["touch"], "elementary"),
        ("What Linux command searches for matching text patterns using regular expressions across files?", "grep", ["grep"], "elementary"),
        ("What Linux command displays real-time dynamic view of active system processes and resource usage?", "top", ["top", "htop"], "elementary"),
        ("What Linux command displays available and used disk space on file systems?", "df", ["df"], "elementary"),
        ("What Linux command displays free and used physical and swap memory in the system?", "free", ["free"], "elementary"),
        ("What is the process ID (PID) of the first user-space process started by the Linux kernel (init/systemd)?", "1", ["1"], "elementary"),
        ("What is a process that has completed execution but still has an entry in the process table called?", "Zombie process", ["Zombie", "zombie", "zombie process"], "intermediate"),
        ("What is a running process called whose parent process has terminated without waiting for it?", "Orphan process", ["Orphan", "orphan", "orphan process"], "intermediate"),
        ("What inter-process communication mechanism allows unidirectional byte streaming between processes in Unix?", "Pipe", ["Pipe", "pipe"], "intermediate"),
        ("What CPU scheduling algorithm selects the process with the shortest burst time first?", "Shortest Job First (SJF)", ["SJF", "Shortest Job First"], "intermediate"),
        ("What situation occurs when high-priority tasks are indirectly preempted by lower-priority tasks holding a shared lock?", "Priority Inversion", ["Priority Inversion", "priority inversion"], "advanced"),
        ("What page replacement algorithm replaces the page that has not been used for the longest period of time?", "Least Recently Used (LRU)", ["LRU", "Least Recently Used"], "intermediate"),
        ("What page replacement algorithm replaces pages in the exact order they were loaded into memory?", "First-In First-Out (FIFO)", ["FIFO", "First-In First-Out"], "elementary"),
        ("What term describes excessive paging where the operating system spends more time swapping pages than executing instructions?", "Thrashing", ["Thrashing", "thrashing"], "intermediate"),
        ("What is the top-level directory of the Unix/Linux directory hierarchy denoted by?", "/", ["/", "root", "root directory"], "elementary"),
        ("What virtual filesystem in Linux provides an interface to kernel data structures and process status?", "/proc", ["/proc", "proc", "procfs"], "intermediate")
    ]
    for prompt, ans, kws, diff in os_items:
        probes.append({
            "probe_id": f"FRESH-OS-{pid:03d}",
            "domain": "computer_science_systems",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 8. Science & Physics (40 probes)
    sci_items = [
        ("What is the chemical symbol for gold?", "Au", ["Au"], "elementary"),
        ("What is the chemical symbol for silver?", "Ag", ["Ag"], "elementary"),
        ("What is the chemical formula for water?", "H2O", ["H2O", "H₂O"], "elementary"),
        ("What is the chemical formula for carbon dioxide?", "CO2", ["CO2", "CO₂"], "elementary"),
        ("What is the acceleration due to gravity on the surface of Earth in m/s^2?", "9.8", ["9.8", "9.81", "9.8 m/s^2"], "elementary"),
        ("What is the speed of light in a vacuum in meters per second?", "3 x 10^8", ["3 x 10^8", "300,000,000", "299,792,458"], "elementary"),
        ("State Newton's First Law of Motion in one sentence.", "An object in motion remains in motion unless acted upon by an external net force.", ["external force", "inertia", "rest or motion"], "elementary"),
        ("What physical law states that Force equals mass times acceleration (F = ma)?", "Newton's Second Law of Motion", ["Newton's Second Law", "Second Law of Motion", "Second Law"], "elementary"),
        ("What physical law states that for every action there is an equal and opposite reaction?", "Newton's Third Law of Motion", ["Newton's Third Law", "Third Law of Motion", "Third Law"], "elementary"),
        ("What is the SI unit of electrical resistance?", "Ohm", ["Ohm", "ohm", "Ω"], "elementary"),
        ("What is the SI unit of electrical current?", "Ampere", ["Ampere", "ampere", "Amp", "A"], "elementary"),
        ("What is the SI unit of electrical potential difference (voltage)?", "Volt", ["Volt", "volt", "V"], "elementary"),
        ("What is the SI unit of energy and work?", "Joule", ["Joule", "joule", "J"], "elementary"),
        ("What is the SI unit of power, equivalent to one joule per second?", "Watt", ["Watt", "watt", "W"], "elementary"),
        ("What is the SI unit of force?", "Newton", ["Newton", "newton", "N"], "elementary"),
        ("What is the SI unit of frequency?", "Hertz", ["Hertz", "hertz", "Hz"], "elementary"),
        ("What equation represents the relationship between voltage, current, and resistance in Ohm's Law?", "V = I * R", ["V = IR", "V = I * R", "V=IR"], "elementary"),
        ("What fundamental subatomic particle carries a negative electric charge?", "Electron", ["Electron", "electron"], "elementary"),
        ("What fundamental subatomic particle carries a positive electric charge in the nucleus?", "Proton", ["Proton", "proton"], "elementary"),
        ("What neutral subatomic particle resides in the atomic nucleus with protons?", "Neutron", ["Neutron", "neutron"], "elementary"),
        ("What is the atomic number of Hydrogen?", "1", ["1"], "elementary"),
        ("What is the atomic number of Carbon?", "6", ["6"], "elementary"),
        ("What is the atomic number of Oxygen?", "8", ["8"], "elementary"),
        ("What temperature corresponds to Absolute Zero in Celsius?", "-273.15", ["-273.15", "-273", "-273.15 C", "-273.15°C"], "elementary"),
        ("What law states that total energy in an isolated system remains constant and cannot be created or destroyed?", "Law of Conservation of Energy", ["Conservation of Energy", "First Law of Thermodynamics"], "elementary"),
        ("What property of a body measures its resistance to any change in its velocity?", "Inertia", ["Inertia", "inertia"], "elementary"),
        ("What type of lens converges light rays to a focal point?", "Convex lens", ["Convex", "converging"], "elementary"),
        ("What type of lens diverges parallel light rays?", "Concave lens", ["Concave", "diverging"], "elementary"),
        ("What phenomenon occurs when light bends as it passes from one medium to another?", "Refraction", ["Refraction", "refraction"], "elementary"),
        ("What phenomenon occurs when light bounces off a boundary or surface?", "Reflection", ["Reflection", "reflection"], "elementary"),
        ("What thermodynamic quantity measures the degree of disorder or randomness in a closed system?", "Entropy", ["Entropy", "entropy"], "intermediate"),
        ("What form of energy does an object possess due to its motion (KE = 1/2 mv^2)?", "Kinetic energy", ["Kinetic energy", "kinetic"], "elementary"),
        ("What form of energy is stored in an object due to its position in a gravitational field (PE = mgh)?", "Potential energy", ["Potential energy", "potential"], "elementary"),
        ("What is the pH value of pure water at 25 degrees Celsius?", "7", ["7", "7.0", "neutral"], "elementary"),
        ("Are solutions with a pH less than 7 acidic or basic?", "Acidic", ["Acidic", "acid"], "elementary"),
        ("Are solutions with a pH greater than 7 acidic or basic?", "Basic", ["Basic", "alkaline", "base"], "elementary"),
        ("What gas do green plants absorb from the atmosphere during photosynthesis?", "Carbon dioxide (CO2)", ["Carbon dioxide", "CO2"], "elementary"),
        ("What gas do green plants release as a byproduct of photosynthesis?", "Oxygen (O2)", ["Oxygen", "O2"], "elementary"),
        ("What is the most abundant gas in Earth's atmosphere?", "Nitrogen", ["Nitrogen", "N2"], "elementary"),
        ("What is the second most abundant gas in Earth's atmosphere?", "Oxygen", ["Oxygen", "O2"], "elementary")
    ]
    for prompt, ans, kws, diff in sci_items:
        probes.append({
            "probe_id": f"FRESH-SCIENCE-{pid:03d}",
            "domain": "science_physics",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 9. Hindi Language in Devanagari (40 probes)
    hindi_items = [
        ("भारत की राजधानी का नाम क्या है?", "नई दिल्ली", ["नई दिल्ली", "दिल्ली"], "elementary"),
        ("सूर्य किस दिशा से उगता है?", "पूर्व", ["पूर्व"], "elementary"),
        ("एक सप्ताह में कितने दिन होते हैं?", "सात", ["सात", "7"], "elementary"),
        ("एक वर्ष में कितने महीने होते हैं?", "बारह", ["बारह", "12"], "elementary"),
        ("भारत के राष्ट्रीय पक्षी का नाम क्या है?", "मोर", ["मोर"], "elementary"),
        ("भारत के राष्ट्रीय पशु का नाम क्या है?", "बाघ", ["बाघ"], "elementary"),
        ("भारत का राष्ट्रीय फल कौन सा है?", "आम", ["आम"], "elementary"),
        ("भारत का राष्ट्रीय फूल कौन सा है?", "कमल", ["कमल"], "elementary"),
        ("हिंदी वर्णमाला में कितने स्वर होते हैं?", "11", ["11", "ग्यारह"], "elementary"),
        ("जल का पर्यायवाची शब्द क्या है?", "पानी", ["पानी", "नीर", "तोय", "वारि"], "elementary"),
        ("सूर्य का पर्यायवाची शब्द क्या है?", "सूरज", ["सूरज", "दिनकर", "भास्कर", "रवि"], "elementary"),
        ("अग्नि का पर्यायवाची शब्द क्या है?", "आग", ["आग", "अनल", "पावक"], "elementary"),
        ("दिन का विलोम शब्द क्या होता है?", "रात", ["रात"], "elementary"),
        ("सत्य का विलोम शब्द क्या होता है?", "असत्य", ["असत्य", "झूठ"], "elementary"),
        ("प्रकाश का विलोम शब्द क्या होता है?", "अंधकार", ["अंधकार", "अंधेरा"], "elementary"),
        ("सुख का विलोम शब्द क्या होता है?", "दुख", ["दुख", "दुःख"], "elementary"),
        ("मित्र का विलोम शब्द क्या होता है?", "शत्रु", ["शत्रु", "दुश्मन"], "elementary"),
        ("कंप्यूटर का हिंदी नाम क्या है?", "संगणक", ["संगणक"], "intermediate"),
        ("भारत के राष्ट्रपिता के रूप में किन्हें जाना जाता है?", "महात्मा गांधी", ["महात्मा गांधी", "गांधीजी"], "elementary"),
        ("भारत का स्वतंत्रता दिवस किस तारीख को मनाया जाता है?", "15 अगस्त", ["15 अगस्त", "पंद्रह अगस्त"], "elementary"),
        ("भारत का गणतंत्र दिवस किस तारीख को मनाया जाता है?", "26 जनवरी", ["26 जनवरी", "छब्बीस जनवरी"], "elementary"),
        ("गंगा नदी किस महासागर या खाड़ी में गिरती है?", "बंगाल की खाड़ी", ["बंगाल की खाड़ी"], "intermediate"),
        ("हिमालय किस दिशा में स्थित है भारत के?", "उत्तर", ["उत्तर", "उत्तर दिशा"], "elementary"),
        ("आकाश का रंग कैसा दिखाई देता है स्वच्छ दिन में?", "नीला", ["नीला"], "elementary"),
        ("वृक्ष हमें कौन सी जीवनदायिनी गैस प्रदान करते हैं?", "ऑक्सीजन", ["ऑक्सीजन", "प्राणवायु"], "elementary"),
        ("मनुष्य सांस में कौन सी गैस अंदर लेते हैं?", "ऑक्सीजन", ["ऑक्सीजन"], "elementary"),
        ("पृथ्वी का उपग्रह कौन सा है?", "चंद्रमा", ["चंद्रमा", "चाँद"], "elementary"),
        ("हमारे सौरमंडल का सबसे बड़ा ग्रह कौन सा है?", "बृहस्पति", ["बृहस्पति"], "intermediate"),
        ("लाल ग्रह के नाम से किस ग्रह को जाना जाता है?", "मंगल", ["मंगल", "मंगल ग्रह"], "elementary"),
        ("ताजमहल भारत के किस शहर में स्थित है?", "आगरा", ["आगरा"], "elementary"),
        ("कुतुब मीनार किस शहर में स्थित है?", "दिल्ली", ["दिल्ली", "नई दिल्ली"], "elementary"),
        ("हवा महल किस शहर में स्थित है?", "जयपुर", ["जयपुर"], "intermediate"),
        ("गेटवे ऑफ इंडिया किस शहर में स्थित है?", "मुंबई", ["मुंबई"], "elementary"),
        ("भारत की मुद्रा का नाम क्या है?", "रुपया", ["रुपया", "भारतीय रुपया"], "elementary"),
        ("दूध से दही बनाने वाले जीवाणु का नाम क्या है?", "लैक्टोबैसिलस", ["लैक्टोबैसिलस", "Lactobacillus"], "advanced"),
        ("संविधान दिवस भारत में कब मनाया जाता है?", "26 नवंबर", ["26 नवंबर"], "intermediate"),
        ("विश्व की सबसे ऊंची पर्वत चोटी कौन सी है?", "माउंट एवरेस्ट", ["माउंट एवरेस्ट", "एवरेस्ट"], "elementary"),
        ("भारत के प्रथम प्रधानमंत्री कौन थे?", "पंडित जवाहरलाल नेहरू", ["जवाहरलाल नेहरू", "नेहरू"], "elementary"),
        ("भारत के प्रथम राष्ट्रपति कौन थे?", "डॉ. राजेंद्र प्रसाद", ["राजेंद्र प्रसाद", "डॉ. राजेंद्र प्रसाद"], "intermediate"),
        ("हिंदी दिवस कब मनाया जाता है?", "14 सितंबर", ["14 सितंबर", "चौदह सितंबर"], "intermediate")
    ]
    for prompt, ans, kws, diff in hindi_items:
        probes.append({
            "probe_id": f"FRESH-HINDI-{pid:03d}",
            "domain": "hindi_devanagari",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 10. Hinglish Conversational & Dialogue (40 probes)
    hing_items = [
        ("Aapka naam kya hai?", "JARVIS", ["JARVIS", "Jarvis"], "elementary"),
        ("Aap kis model dwara sanchalit ho?", "VISION", ["VISION", "Vision"], "elementary"),
        ("Kripya mujhe batayein ki France ki capital kya hai?", "Paris", ["Paris", "पेरिस"], "elementary"),
        ("Water ka boiling point kitna hota hai Celsius mein?", "100", ["100", "100 C", "100°C"], "elementary"),
        ("1 ghante mein kitne minutes hote hain?", "60", ["60", "60 minutes"], "elementary"),
        ("1 minute mein kitne seconds hote hain?", "60", ["60", "60 seconds"], "elementary"),
        ("1 kilometer mein kitne meters hote hain?", "1000", ["1000", "1000 meters", "1000m"], "elementary"),
        ("Computer mein CPU ka full form kya hota hai?", "Central Processing Unit", ["Central Processing Unit"], "elementary"),
        ("Computer mein RAM ka full form kya hota hai?", "Random Access Memory", ["Random Access Memory"], "elementary"),
        ("Internet par URL ka full form kya hota hai?", "Uniform Resource Locator", ["Uniform Resource Locator"], "intermediate"),
        ("Internet par HTTP ka full form kya hota hai?", "Hypertext Transfer Protocol", ["Hypertext Transfer Protocol"], "intermediate"),
        ("HTML ka full form kya hota hai?", "HyperText Markup Language", ["HyperText Markup Language", "Hypertext Markup Language"], "elementary"),
        ("CSS ka full form kya hota hai web development mein?", "Cascading Style Sheets", ["Cascading Style Sheets"], "elementary"),
        ("Python mein list ko sort karne ke liye kaun sa method use karte hain?", "sort", ["sort", "sort()", "sorted"], "elementary"),
        ("Python mein dictionary se value nikalne ke liye kaun sa method use hota hai?", "get", ["get", "get()"], "elementary"),
        ("Sun kis disha se rise hota hai?", "East", ["East", "east", "Purv", "poorv"], "elementary"),
        ("Earth ka natural satellite kaun hai?", "Moon", ["Moon", "moon", "chandrama", "chand"], "elementary"),
        ("Triangle ke teeno angles ka sum kitna hota hai degrees mein?", "180", ["180", "180 degrees"], "elementary"),
        ("Square ki kitni sides hoti hain?", "4", ["4", "four", "chaar"], "elementary"),
        ("Circle ka area nikalne ka formula kya hai?", "pi * r^2", ["pi * r^2", "pi r^2", "πr²", "pir^2"], "intermediate"),
        ("Speed nikalne ka formula kya hai distance aur time ke sath?", "Distance / Time", ["Distance / Time", "distance/time", "d/t"], "elementary"),
        ("Human body ka normal temperature Celsius mein kitna hota hai approx?", "37", ["37", "37°C", "37 C"], "intermediate"),
        ("Water ka freezing point kitna hota hai Celsius mein?", "0", ["0", "0°C", "0 C"], "elementary"),
        ("Light ki speed kitni hoti hai vacuum mein approximately?", "3 x 10^8 m/s", ["3 x 10^8", "300,000 km/s", "300000"], "elementary"),
        ("Kya Python ek compiled language hai ya interpreted language?", "Interpreted", ["Interpreted", "interpreted"], "elementary"),
        ("Java code compile hone ke baad kaun sa file format banta hai?", "Bytecode (.class)", ["Bytecode", "class", ".class"], "intermediate"),
        ("Git mein changes commit karne se pehle files ko kahan add karte hain?", "Staging area", ["stage", "staging", "index"], "intermediate"),
        ("Git mein repository ka status check karne ki command kya hai?", "git status", ["git status"], "elementary"),
        ("Git mein branch create karne ki command kya hai?", "git branch or git checkout -b", ["git branch", "git checkout -b", "git switch"], "elementary"),
        ("Linux terminal mein files list karne ki command kya hai?", "ls", ["ls"], "elementary"),
        ("Linux terminal mein directory change karne ki command kya hai?", "cd", ["cd"], "elementary"),
        ("Linux terminal mein file delete karne ki command kya hai?", "rm", ["rm"], "elementary"),
        ("Windows Command Prompt mein directory list karne ki command kya hai?", "dir", ["dir"], "elementary"),
        ("Ek byte mein kitne bits hote hain?", "8", ["8", "8 bits"], "elementary"),
        ("Ek kilobyte (KB) mein kitne bytes hote hain?", "1024", ["1024", "1000"], "elementary"),
        ("Ek megabyte (MB) mein kitne kilobytes hote hain?", "1024", ["1024", "1000"], "elementary"),
        ("Ek gigabyte (GB) mein kitne megabytes hote hain?", "1024", ["1024", "1000"], "elementary"),
        ("DNS ka full form kya hota hai networking mein?", "Domain Name System", ["Domain Name System"], "intermediate"),
        ("IP ka full form kya hota hai Internet networking mein?", "Internet Protocol", ["Internet Protocol"], "elementary"),
        ("WiFi ka full form kya hota hai standard terms mein?", "Wireless Fidelity", ["Wireless Fidelity"], "elementary")
    ]
    for prompt, ans, kws, diff in hing_items:
        probes.append({
            "probe_id": f"FRESH-HINGLISH-{pid:03d}",
            "domain": "hinglish_dialog",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 11. Formal Logic & Deduction (30 probes)
    logic_items = [
        ("Premise 1: All mammals are warm-blooded. Premise 2: Whales are mammals. Conclusion: Are whales warm-blooded?", "Yes", ["Yes", "yes", "whales are warm-blooded"], "elementary"),
        ("Premise 1: No reptiles have fur. Premise 2: A snake is a reptile. Conclusion: Does a snake have fur?", "No", ["No", "no", "does not have fur"], "elementary"),
        ("Premise 1: If it rains, the ground gets wet. Premise 2: The ground is not wet. What can we conclude about whether it rained?", "It did not rain", ["did not rain", "not rain", "it hasn't rained"], "intermediate"),
        ("What logical rule of inference concludes Q given 'If P then Q' and 'P'?", "Modus Ponens", ["Modus Ponens", "modus ponens"], "intermediate"),
        ("What logical rule of inference concludes 'Not P' given 'If P then Q' and 'Not Q'?", "Modus Tollens", ["Modus Tollens", "modus tollens"], "intermediate"),
        ("What is the contrapositive of the conditional statement 'If P, then Q'?", "If not Q, then not P", ["If not Q then not P", "If not Q, then not P", "~Q -> ~P"], "intermediate"),
        ("If all squares are rectangles, and all rectangles are quadrilaterals, are all squares quadrilaterals?", "Yes", ["Yes", "yes"], "elementary"),
        ("If some roses are red, and all red things are colored, are some roses colored?", "Yes", ["Yes", "yes"], "elementary"),
        ("What fallacy is committed when someone attacks their opponent's character instead of their argument?", "Ad Hominem", ["Ad Hominem", "ad hominem"], "intermediate"),
        ("What fallacy is committed when someone assumes the premise is true in order to prove it (circular argument)?", "Begging the question", ["Begging the question", "circular reasoning", "petitio principii"], "intermediate"),
        ("What fallacy assumes that because Event B followed Event A, Event A must have caused Event B?", "Post hoc ergo propter hoc", ["Post hoc", "post hoc ergo propter hoc", "false cause"], "intermediate"),
        ("What fallacy misrepresents an opponent's argument to make it easier to attack?", "Straw Man fallacy", ["Straw Man", "straw man", "strawman"], "intermediate"),
        ("What is the truth value of: True AND False in Boolean logic?", "False", ["False", "false"], "elementary"),
        ("What is the truth value of: True OR False in Boolean logic?", "True", ["True", "true"], "elementary"),
        ("What is the truth value of: NOT (True AND True) in Boolean logic?", "False", ["False", "false"], "elementary"),
        ("What is the truth value of: (False OR False) in Boolean logic?", "False", ["False", "false"], "elementary"),
        ("What is the truth value of: True XOR True in exclusive OR logic?", "False", ["False", "false", "0"], "elementary"),
        ("What is the truth value of: True XOR False in exclusive OR logic?", "True", ["True", "true", "1"], "elementary"),
        ("According to De Morgan's Law, what is NOT (A AND B) equivalent to?", "NOT A OR NOT B", ["NOT A OR NOT B", "~A OR ~B", "not A or not B"], "intermediate"),
        ("According to De Morgan's Law, what is NOT (A OR B) equivalent to?", "NOT A AND NOT B", ["NOT A AND NOT B", "~A AND ~B", "not A and not B"], "intermediate"),
        ("If Alice is taller than Bob, and Bob is taller than Charlie, who is the shortest?", "Charlie", ["Charlie", "charlie"], "elementary"),
        ("If today is Tuesday, what day was it three days ago?", "Saturday", ["Saturday", "saturday"], "elementary"),
        ("A father and son have a combined age of 40. The father is 30 years older than the son. How old is the son?", "5", ["5", "5 years old"], "intermediate"),
        ("If you have 3 apples and you take away 2, how many apples do you have?", "2", ["2", "two"], "elementary"),
        ("Some cats are black. All black animals have dark fur. Can we conclude that all cats have dark fur?", "No", ["No", "no"], "elementary"),
        ("If no fish can walk, and salmon is a fish, can salmon walk?", "No", ["No", "no", "cannot walk"], "elementary"),
        ("What term describes a proposition that is always true in every possible interpretation (e.g. P OR NOT P)?", "Tautology", ["Tautology", "tautology"], "intermediate"),
        ("What term describes a proposition that is always false in every possible interpretation (e.g. P AND NOT P)?", "Contradiction", ["Contradiction", "contradiction"], "intermediate"),
        ("If all birds lay eggs, and a penguin is a bird, does a penguin lay eggs?", "Yes", ["Yes", "yes"], "elementary"),
        ("Is the statement 'This statement is false' a paradox or a sound deductive argument?", "Paradox", ["Paradox", "paradox"], "elementary")
    ]
    for prompt, ans, kws, diff in logic_items:
        probes.append({
            "probe_id": f"FRESH-LOGIC-{pid:03d}",
            "domain": "formal_reasoning",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 12. Structured Output & Tool Orchestration (30 probes)
    tool_items = [
        ("Output strict JSON representing a successful operation: {\"status\": \"ok\", \"code\": 200}", "{\"status\": \"ok\", \"code\": 200}", ["\"status\": \"ok\"", "\"code\": 200"], "elementary"),
        ("Output strict JSON with user name 'Alice' and age 25: {\"name\": \"Alice\", \"age\": 25}", "{\"name\": \"Alice\", \"age\": 25}", ["\"name\": \"Alice\"", "\"age\": 25"], "elementary"),
        ("What tool does JARVIS call to move the desktop mouse pointer to (x=500, y=300)?", "desktop_move_mouse", ["desktop_move_mouse", "mouse_move"], "elementary"),
        ("What tool does JARVIS call to click the mouse button at the current position?", "desktop_mouse_click", ["desktop_mouse_click", "mouse_click"], "elementary"),
        ("What tool does JARVIS call to take a full-screen screenshot of the desktop display?", "desktop_take_screenshot", ["desktop_take_screenshot", "screenshot"], "elementary"),
        ("What tool does JARVIS call to type text into an active application window?", "desktop_type_text", ["desktop_type_text", "type_text"], "elementary"),
        ("What tool does JARVIS call to send keyboard shortcuts like Ctrl+C or Alt+Tab?", "desktop_key_combination", ["desktop_key_combination", "key_combination", "hotkey"], "elementary"),
        ("What tool does JARVIS call to list visible application windows on the desktop?", "desktop_list_windows", ["desktop_list_windows", "list_windows"], "elementary"),
        ("What tool does JARVIS call to perform live Google web search?", "google_search", ["google_search", "web_search"], "elementary"),
        ("What tool does JARVIS call to find places and routes using Google Maps Platform?", "google_maps", ["google_maps", "maps"], "elementary"),
        ("What security check is mandatory before JARVIS executes irreversible desktop operations?", "Permission Confirmation", ["permission", "confirmation", "confirm"], "elementary"),
        ("What happens immediately when the user commands 'JARVIS EMERGENCY STOP'?", "All automation halts immediately", ["halt", "stop", "abort", "freeze"], "elementary"),
        ("Format a tool call to search for 'quantum computing' with tool 'google_search':", "{\"tool\": \"google_search\", \"parameters\": {\"query\": \"quantum computing\"}}", ["\"tool\": \"google_search\"", "\"query\": \"quantum computing\""], "intermediate"),
        ("Format a tool call to launch 'notepad.exe' with tool 'desktop_launch_app':", "{\"tool\": \"desktop_launch_app\", \"parameters\": {\"application\": \"notepad.exe\"}}", ["\"desktop_launch_app\"", "\"notepad.exe\""], "intermediate"),
        ("In JSON, what character opens an array?", "[", ["[", "bracket", "square bracket"], "elementary"),
        ("In JSON, what character opens an object?", "{", ["{", "brace", "curly brace"], "elementary"),
        ("Are trailing commas allowed in standard JSON specifications (RFC 8259)?", "No", ["No", "no", "not allowed"], "elementary"),
        ("In JSON, can string keys be enclosed in single quotes?", "No", ["No", "no", "double quotes only"], "elementary"),
        ("What value represents null or absent data in JSON?", "null", ["null"], "elementary"),
        ("What boolean values are valid in JSON?", "true and false", ["true and false", "true", "false"], "elementary"),
        ("Format a tool call to take a screenshot with tool 'desktop_take_screenshot':", "{\"tool\": \"desktop_take_screenshot\", \"parameters\": {}}", ["\"tool\": \"desktop_take_screenshot\""], "intermediate"),
        ("Format a tool call to scroll down 3 ticks with tool 'desktop_mouse_scroll':", "{\"tool\": \"desktop_mouse_scroll\", \"parameters\": {\"clicks\": -3}}", ["\"desktop_mouse_scroll\"", "-3"], "intermediate"),
        ("What protocol is used by JARVIS to participate in real-time WebRTC audio calls?", "WebRTC", ["WebRTC", "webrtc"], "intermediate"),
        ("What tool is called by JARVIS to list connected physical and virtual Android devices?", "android_list_devices", ["android_list_devices", "adb devices"], "intermediate"),
        ("What protocol does JARVIS use to transcribe caller audio in real-time?", "Speech-to-Text / Audio Streaming", ["Speech-to-Text", "STT", "audio stream", "transcription"], "intermediate"),
        ("Output strict JSON containing an array of prime numbers [2, 3, 5, 7]:", "{\"primes\": [2, 3, 5, 7]}", ["[2, 3, 5, 7]"], "elementary"),
        ("Output strict JSON with key 'result' set to boolean true:", "{\"result\": true}", ["\"result\": true", "{\"result\": true}"], "elementary"),
        ("What HTTP method is typically used to retrieve data from a REST API endpoint?", "GET", ["GET"], "elementary"),
        ("What HTTP method is typically used to create a new resource on a server?", "POST", ["POST"], "elementary"),
        ("What HTTP status code signifies that a requested URL resource was Not Found?", "404", ["404", "404 Not Found"], "elementary")
    ]
    for prompt, ans, kws, diff in tool_items:
        probes.append({
            "probe_id": f"FRESH-TOOL-{pid:03d}",
            "domain": "tool_orchestration",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 13. Electronics, Embedded Systems & Robotics (20 probes)
    embedded_items = [
        ("What electronic component stores electrical energy in an electrostatic field?", "Capacitor", ["Capacitor", "capacitor"], "elementary"),
        ("What electronic component restricts the flow of electric current?", "Resistor", ["Resistor", "resistor"], "elementary"),
        ("What semiconductor device allows current to flow in only one direction?", "Diode", ["Diode", "diode"], "elementary"),
        ("What three-terminal semiconductor device is used to amplify or switch electrical signals?", "Transistor", ["Transistor", "transistor", "BJT", "MOSFET"], "elementary"),
        ("What technique controls motor speed or LED brightness by varying the pulse width of a digital signal?", "Pulse Width Modulation (PWM)", ["PWM", "Pulse Width Modulation"], "intermediate"),
        ("What hardware circuit converts an analog continuous voltage signal into a discrete digital number?", "Analog-to-Digital Converter (ADC)", ["ADC", "Analog-to-Digital Converter"], "intermediate"),
        ("What serial communication protocol uses two wires: SDA (data) and SCL (clock)?", "I2C (Inter-Integrated Circuit)", ["I2C", "I²C"], "intermediate"),
        ("What synchronous serial communication protocol uses MOSI, MISO, SCK, and CS lines?", "SPI (Serial Peripheral Interface)", ["SPI", "Serial Peripheral Interface"], "intermediate"),
        ("What asynchronous serial communication protocol uses TX and RX lines without a shared clock?", "UART", ["UART"], "intermediate"),
        ("What motor type provides precise angular positioning using closed-loop feedback?", "Servo motor", ["Servo", "servo motor", "servomotor"], "elementary"),
        ("What motor type divides a full rotation into a number of equal discrete steps?", "Stepper motor", ["Stepper", "stepper motor"], "elementary"),
        ("What sensor measures linear acceleration and angular rate (often combining accelerometer and gyroscope)?", "Inertial Measurement Unit (IMU)", ["IMU", "Inertial Measurement Unit"], "intermediate"),
        ("What optical remote sensing technology measures distances by illuminating targets with laser pulses?", "LiDAR", ["LiDAR", "Lidar", "lidar"], "intermediate"),
        ("What popular open-source microcontroller prototyping platform is based on ATmega328P?", "Arduino", ["Arduino"], "elementary"),
        ("What single-board computer running Linux is widely used in robotics education and projects?", "Raspberry Pi", ["Raspberry Pi", "RPi"], "elementary"),
        ("What middleware framework provides message passing, drivers, and packages for robot development?", "Robot Operating System (ROS)", ["ROS", "Robot Operating System"], "intermediate"),
        ("What law governs the relationship between current, voltage, and resistance in DC circuits?", "Ohm's Law", ["Ohm's Law", "Ohms Law"], "elementary"),
        ("What is the voltage of a standard single cell lithium polymer (LiPo) battery when fully charged?", "4.2", ["4.2", "4.2V", "4.2 V"], "intermediate"),
        ("What electronic component steps voltage up or down in AC circuits using mutual induction?", "Transformer", ["Transformer", "transformer"], "elementary"),
        ("What logic gate outputs True if and only if both of its inputs are True?", "AND gate", ["AND", "AND gate"], "elementary")
    ]
    for prompt, ans, kws, diff in embedded_items:
        probes.append({
            "probe_id": f"FRESH-EMBEDDED-{pid:03d}",
            "domain": "electronics_robotics",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # 14. Computer Networking & Protocols (20 probes)
    net_items = [
        ("How many layers are defined in the standard ISO/OSI networking reference model?", "7", ["7", "seven"], "elementary"),
        ("Which layer of the OSI model is responsible for routing packets across logical networks (IP layer)?", "Network Layer (Layer 3)", ["Network", "Network Layer", "Layer 3"], "elementary"),
        ("Which transport layer protocol provides connection-oriented, reliable, ordered byte streams?", "TCP (Transmission Control Protocol)", ["TCP", "Transmission Control Protocol"], "elementary"),
        ("Which transport layer protocol provides connectionless, lightweight, low-overhead datagram communication?", "UDP (User Datagram Protocol)", ["UDP", "User Datagram Protocol"], "elementary"),
        ("What default port number is used for unencrypted HTTP web traffic?", "80", ["80"], "elementary"),
        ("What default port number is used for encrypted HTTPS web traffic?", "443", ["443"], "elementary"),
        ("What default port number is used for SSH (Secure Shell) remote access?", "22", ["22"], "elementary"),
        ("What default port number is used for DNS (Domain Name System) queries?", "53", ["53"], "intermediate"),
        ("What protocol automatically assigns dynamic IP addresses to client devices joining a local network?", "DHCP", ["DHCP"], "elementary"),
        ("What protocol translates human-readable domain names (e.g. google.com) into numerical IP addresses?", "DNS", ["DNS", "Domain Name System"], "elementary"),
        ("What technology allows multiple private IP devices on a local area network to share a single public IP address?", "Network Address Translation (NAT)", ["NAT", "Network Address Translation"], "intermediate"),
        ("How many bits are in a standard IPv4 address?", "32", ["32", "32 bits"], "elementary"),
        ("How many bits are in a modern IPv6 address?", "128", ["128", "128 bits"], "elementary"),
        ("What networking device forwards data frames at Layer 2 using physical MAC addresses?", "Switch", ["Switch", "switch", "network switch"], "elementary"),
        ("What networking device forwards data packets at Layer 3 between different subnets based on IP addresses?", "Router", ["Router", "router"], "elementary"),
        ("What utility tool sends ICMP Echo Request messages to test network reachability to a remote host?", "ping", ["ping"], "elementary"),
        ("What utility tool tracks the route and intermediate router hops taken by packets across an IP network?", "traceroute or tracert", ["traceroute", "tracert"], "elementary"),
        ("What cryptographic protocol secures communication over computer networks, succeeding SSL?", "TLS", ["TLS", "Transport Layer Security", "SSL/TLS"], "intermediate"),
        ("What loopback IPv4 address always refers to the local host machine?", "127.0.0.1", ["127.0.0.1", "localhost"], "elementary"),
        ("What HTTP status code indicates a successful request response from a web server?", "200", ["200", "200 OK"], "elementary")
    ]
    for prompt, ans, kws, diff in net_items:
        probes.append({
            "probe_id": f"FRESH-NET-{pid:03d}",
            "domain": "networking_protocols",
            "difficulty": diff,
            "prompt": prompt,
            "expected_answer": ans,
            "expected_keywords": kws
        })
        pid += 1

    # Write out 500 probes
    print(f"Total fresh probes created: {len(probes)}")
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        for p in probes:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"Successfully serialized 500 fresh probes to: {OUT_FILE}")


if __name__ == "__main__":
    build_500_probes()
