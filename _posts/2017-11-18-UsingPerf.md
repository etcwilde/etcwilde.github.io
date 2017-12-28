---
title: Perf - Perfect Profiling of C/C++ on Linux
description: Looking at profiling on Linux
tags: profiling, linux, CPP, C
---

_This was originally posted to my account on [dev.to](https://dev.to/etcwilde/perf---perfect-profiling-of-cc-on-linux-of)_

I've seen power-Visual Studio users do amazing things with the profiler and debugger. It looks amazing, but there is one small problem. I'm on Linux. No visual studio for me. How do I profile now? There are some profilers out there for Linux too, each with varying degrees of usability.

Perf is a neat little tool that I just found for profiling programs. Perf uses statistical profiling, where it polls the program and sees what function is working. This is less accurate, but has less of a performance hit than something like Callgrind, which tracks every call. The results are still reasonable accurate, and even with fewer samples, it will show which functions are taking a lot of time, even if it misses functions that are very fast (which are probably not the ones you are looking for while profiling anyway).

With a rather contrived example, we implement the infamous Fibonacci sequence in the most pedagogical way possible. Basic Recursion.

```c
// fib.c
#include <stdio.h>
#include <stdlib.h>

int fib(int x) {
  if (x == 0) return 0;
  else if (x == 1) return 1;
  return fib(x - 1) + fib(x - 2);
}

int main(int argc, char *argv[]) {

  for (size_t i = 0; i < 45; ++i) {
    printf("%d\n", fib(i));
  }
  return 0;
}
```

Running the program with time gives us:

```sh
$ time ./fib

...

./fib  15.05s user 0.00s system 99% cpu 15.059 total
```

It seems that the program stops outputting fast enough shortly after 40 numbers. My machine is able to run 40 numbers in ~ 2 seconds, but if you bump that up to 45, it takes a whopping 15 seconds. But being completely naive, I can't spot the issue. I need to profile it.

```sh
$ perf record ./fib
```

Running the program again using this command generates the `perf.data` file, which contains all of the time information of our program. Other than creating this new file, nothing exciting shows up. It says how many times perf woke up, the number of samples, and the size of the perf.data file.

```sh
[ perf record: Woken up 10 times to write data ]
[ perf record: Captured and wrote 2.336 MB perf.data (60690 samples) ]
```

Things get interesting when we run:

```sh
perf report
```

which gives us the following view

![perf default output](https://thepracticaldev.s3.amazonaws.com/i/d5lqrr3dazj4rue5bdxd.png)

Okay, great. So basically, it doesn't tell us too much. It does say that we're spending all of our time in the fib function, but not much else. We can hit enter with the `fib` function highlighted, we get a few options. One is to annotate the function. This shows us a disassembly of the instructions in the function, with the percentage of time being taken by each one. So... we can optimize at the assembly level I guess? Seems a bit extreme. That's a little too low-level for most of us mortals.

![perf disassembly](https://thepracticaldev.s3.amazonaws.com/i/0jt1ygl6o0nzdgvqgf53.png)

There is actually some helpful information in this view if we're clever though. We'll get back on that later.

By default, perf only collects time information. We probably want to see a callgraph since we're making calls. Maybe the base case is the culprit (returning a single number is always suspicious after all (laugh with me here, that's a joke)).

To get the call graph, we pass the `-g` option to `perf record`.

```sh
$ perf record -g ./fib
```

And wait for it to run again... Then run `perf report` again to see the new view.

![perf graph](https://thepracticaldev.s3.amazonaws.com/i/jxx3yg7wt8ex5lafzpll.png)

Not super different. Neat! Okay, so there are some differences between the first run and the second. Namely, instead of having an `overhead` column, it now has a `children` and `self` column, as well as some `+` signs next to some function calls.

Children refers to the overhead of subsequent calls, while self refers to the cost of the function itself. A high children overhead, and a low self overhead indicates that the function makes a call that is expensive, but a high self overhead indicates that the function itself is expensive.

The `+` indicates that the function makes a call that is accessible. Not all functions are follow-able, likely due to the optimizer striping the function names (or `strip -d` which strips debugging symbols) to shrink the binary.

Highlighting a row and hitting enter will expand it, showing the functions called. Note that some older versions of `perf` show the callees by default, not the the functions being called from the function we're looking at. If you are using an older version it might be necessary to change this behaviour by calling record with `perf record -g 'graph,0.5,caller'`.

![perf graph expanded](https://thepracticaldev.s3.amazonaws.com/i/858b8ev0c7rlviowp8y7.png)

In my case, I expanded the call to the `main` function, which doesn't spend much time inside of itself. Inside, there are a bunch of calls the the 'fib' function. The bottom one has a `+` symbol next to it, indicating that it can be expanded. expanding it shows another call to fib, with a `+` symbol.

So.. eventually, we get this big long chain of calls to fib from fib. So recursion strikes again!
Going back to the disassembly, most of the time is spent doing the `mov %rsp,%rbp` which are the registers responsible for the stack and frame pointers in the x86 architecture. Since we see that there is a chain of calls to the fib function, and this particular instruction is quite hot, there's a good indication that something about the recursion is to blame. Now we know what to fix. Fixing it is up to you. Some solutions might include memoization, or emulating recursion with a stack and a while loop, or even a combination of both, but that is beyond the scope of this post.

While this is a contrived example, it gives an introduction to profiling using the perf tool. There are many additional features that are not covered here, but this should be enough to get you started with profiling using perf. The results from perf are not perfect, but they are usable. There are other tools out there, but I rather enjoy the interface with perf, and that it doesn't hurt runtime performance very much. What do you think? What are your favourite profilers and tools for profiling?
